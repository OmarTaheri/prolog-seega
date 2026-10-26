/*  api.pl -- JSON entry point used by the Python API (via Janus or a pipe).

    WHAT THIS FILE DOES
    -------------------
    It is the "door" between Python and Prolog. Python sends a JSON text,
    this file turns it into Prolog terms, calls the rules / AI, and turns
    the answer back into JSON text.

        Python  --"{"cmd":"play", "state":{...}, "move":{...}}"-->  handle/2
        Python  <--"{"ok":true, "state":{...}, "legal":[...]}"---   handle/2

    handle(+RequestText, -ResponseText)
    Request:  {"cmd": "new" | "legal" | "play" | "ai" | "hint", ...}

    The server keeps NO memory between requests (it is "stateless"): the
    browser sends the full game state every time.
*/
:- module(seega_api, [handle/2, serve_stdio/0]).
% library(json) moved out of library(http/json) in SWI-Prolog 10.
% TRICK: conditional compilation. :- if / :- else / :- endif works like
% #ifdef in C: only one of the two lines is loaded, depending on which
% library exists. So the same file works on SWI-Prolog 9 (Docker) and 10.
:- if(exists_source(library(json))).
:- use_module(library(json)).
:- else.
:- use_module(library(http/json)).
:- endif.
:- use_module(board).
:- use_module(rules).
:- use_module(eval).
:- use_module(ai).

/*  handle(+In, -Out)
      1. atom_json_dict: JSON text -> SWI dict
      2. read "cmd" and call dispatch/3 for that command
      3. add ok:true, or ok:false with an error message
      4. json_write_dict: dict -> JSON text

    TRICK: catch(Goal, Error, Recovery) is try/catch. If anything throws an
    exception (bad JSON, a missing field...), we still answer with an error
    message instead of crashing the Prolog process.
    If dispatch simply FAILS (for example an illegal move), we also answer
    with ok:false.
*/
handle(In, Out) :-
    catch(( atom_json_dict(In, Req, []),
            get_dict(cmd, Req, CmdS),
            atom_string(Cmd, CmdS),            % "play" (string) -> play (atom)
            (   dispatch(Cmd, Req, Resp0)
            ->  put_dict(ok, Resp0, true, Resp)
            ;   Resp = _{ok:false, error:"Request failed (illegal move or bad state)"}
            ) ),
          E,
          ( message_to_codes(E, Msg), Resp = _{ok:false, error:Msg} )),
    % with_output_to(string(Out), Goal) captures everything Goal prints into Out
    with_output_to(string(Out), json_write_dict(current_output, Resp, [width(0)])).

message_to_codes(E, Msg) :- format(string(Msg), "~q", [E]).

/*  Line-oriented server: one JSON request per line on stdin.
    Used when Python starts "swipl" as a separate program (backend/bridge.py).

    TRICK: the repeat ... fail loop (a "failure-driven loop").
      repeat   always succeeds again when Prolog backtracks into it
      fail     forces backtracking
    So: read a line, answer it, fail -> back to repeat -> read the next
    line ... forever. When the input ends (end_of_file) the cut (!) stops
    the loop and serve_stdio succeeds.
    flush_output makes sure Python receives the answer right away.
*/
serve_stdio :-
    set_stream(user_input, encoding(utf8)),
    set_stream(user_output, encoding(utf8)),
    repeat,
    read_line_to_string(user_input, Line),
    (   Line == end_of_file
    ->  !
    ;   handle(Line, Out),
        write(user_output, Out), nl(user_output), flush_output(user_output),
        fail
    ).

                 /*******************************
                 *           COMMANDS           *
                 *******************************/

%   dispatch(+Command, +Request, -Response): one clause per command.
%   Prolog picks the clause by matching the first argument (new, legal, ...).

%   "new": a fresh game and its legal moves.
dispatch(new, _, _{state:J, legal:L}) :-
    initial_state(S),
    state_json(S, J),
    legal_json(S, L).

%   "legal": just the legal moves of the given state.
dispatch(legal, Req, _{legal:L}) :-
    req_state(Req, S),
    legal_json(S, L).

%   "play": a human plays a move. We return the new state, its legal moves
%   and what was captured.
%   If the move is illegal, play_move fails -> dispatch fails -> ok:false.
dispatch(play, Req, _{state:J, legal:L, captured:Caps, move:MJ, label:Lbl}) :-
    req_state(Req, S0),
    get_dict(move, Req, MJ0), json_move(MJ0, M),
    req_hist(Req, Hist),
    play_move(S0, M, Hist, S, Caps), !,
    move_json(M, MJ), move_label(M, Lbl),
    state_json(S, J),
    legal_json(S, L).

%   "ai": the engine searches, PLAYS its best move, and sends back the search
%   tree and statistics so the website can draw them.
dispatch(ai, Req, Resp) :-
    search_request(Req, S0, M, V, Tree, Stats),
    req_hist(Req, Hist),
    play_move(S0, M, Hist, S, Caps), !,
    move_json(M, MJ), move_label(M, Lbl),
    state_json(S, J), legal_json(S, L),
    Resp = _{move:MJ, label:Lbl, score:V, state:J, legal:L,
             captured:Caps, tree:Tree, stats:Stats}.

%   "hint": same search as "ai", but the move is NOT played: the website
%   only shows it on the board and draws the search tree.
dispatch(hint, Req, Resp) :-
    search_request(Req, S0, M, V, Tree, Stats),
    apply_move(S0, M, _, Caps), !,
    move_json(M, MJ), move_label(M, Lbl),
    Resp = _{move:MJ, label:Lbl, score:V, captured:Caps,
             tree:Tree, stats:Stats}.

%   search_request: read the state and the settings from the request and
%   run best_move. The numbers are clamped to safe limits so a request
%   cannot ask for a search that takes forever:
%     depth 1..6 (default 2),  drawn tree depth 1..3 (default 2)
search_request(Req, S, M, V, Tree, Stats) :-
    req_state(Req, S),
    \+ game_over(S),
    req_int(Req, depth, 2, 1, 6, Depth0),
    % The drop phase has ~24 moves per ply, so it is searched less deeply.
    req_int(Req, show_depth, 2, 1, 3, Show0),
    (   state_phase(S, drop)
    ->  Depth is min(Depth0, 3), Show is min(Show0, min(2, Depth))
    ;   Depth = Depth0, Show is min(Show0, Depth)
    ),
    req_hist(Req, Hist),
    best_move(S, Depth, Show, Hist, M, V, Tree, Stats),
    M \== none.

%   History of position keys sent by the client (positions already played).
%   include(string, L, Hist) keeps only the elements that are strings
%   (ignores anything strange the client might send).
req_hist(Req, Hist) :-
    (   get_dict(history, Req, L), is_list(L)
    ->  include(string, L, Hist)
    ;   Hist = []
    ).

/*  play_move(+State0, +Move, +History, -State, -Captured)
    Threefold repetition: when a movement-phase position appears for the
    third time, the game ends and the side with more pieces wins.
    History already contains the earlier positions, so if the new position
    is in it 2 times, this is the 3rd time.
    aggregate_all(count, member(K, Hist), N) counts how often K is in the list.
*/
play_move(S0, M, Hist, S, Caps) :-
    apply_move(S0, M, S1, Caps),
    (   state_phase(S1, move),
        state_key(S1, K),
        aggregate_all(count, member(K, Hist), N), N >= 2
    ->  over_by_count(S1, S)
    ;   S = S1
    ).

%   req_int(+Req, +Key, +Default, +Low, +High, -Value): read a whole number
%   from the request; use Default if it is missing; keep it in Low..High.
req_int(Req, Key, Default, Lo, Hi, V) :-
    (   get_dict(Key, Req, V0), integer(V0) -> true ; V0 = Default ),
    V is max(Lo, min(Hi, V0)).

                 /*******************************
                 *        STATE <-> JSON        *
                 *******************************/

%   state_json(+State, -Dict): Prolog state term -> JSON object.
%   Prolog uses the atom none, JSON uses null, so we translate them.
%   counts (stones on the board) are added to help the website.
state_json(s(B, Phase, T, HW, HB, DL, Ch, NC, W, X), J) :-
    board_string(B, BS),
    piece_count(B, w, CW), piece_count(B, b, CB),
    none_null(Ch, ChJ), none_null(W, WJ),
    J = _{board:BS, phase:Phase, turn:T, hand:_{w:HW, b:HB},
          drops_left:DL, chain:ChJ, nocap:NC, winner:WJ, extra_turn:X,
          counts:_{w:CW, b:CB}}.

req_state(Req, S) :-
    get_dict(state, Req, J),
    json_state(J, S).

%   json_state(+Dict, -State): JSON object -> Prolog state term (the reverse).
%   J.board is SWI's dict syntax: "the value of key board in dict J".
%   JSON strings ("drop", "w") become atoms (drop, w) with atom_string.
json_state(J, s(B, Phase, T, HW, HB, DL, Ch, NC, W, X)) :-
    board_string(B, J.board),
    atom_string(Phase, J.phase),
    atom_string(T, J.turn),
    get_dict(hand, J, H), get_dict(w, H, HW), get_dict(b, H, HB),
    DL = J.drops_left,
    null_none(J.chain, Ch),
    NC = J.nocap,
    (   get_dict(winner, J, W0), W0 \== null -> atom_string(W, W0) ; W = none ),
    (   get_dict(extra_turn, J, X0) -> X = X0 ; X = false ).

%   none <-> null. The cut stops the second clause ("any other value stays
%   the same") from also matching none/null.
none_null(none, null) :- !.
none_null(X, X).
null_none(null, none) :- !.
null_none(X, X).

%   json_move: {"type":"move","from":7,"to":12} -> move(7, 12)
json_move(J, M) :-
    get_dict(type, J, TS), atom_string(Type, TS),
    (   Type == drop -> M = drop(J.to)
    ;   Type == move -> M = move(J.from, J.to)
    ;   Type == stop -> M = stop
    ).

%   legal_json: every legal move as JSON, each with its label ("c4-c3").
%   J0.put(label, Lb) returns a copy of dict J0 with the extra key label.
legal_json(S, L) :-
    legal_moves(S, Ms),
    findall(J, ( member(M, Ms), move_json(M, J0), move_label(M, Lb), J = J0.put(label, Lb) ), L).
