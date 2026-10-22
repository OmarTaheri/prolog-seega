/*  api.pl -- JSON entry point used by the Python API (via Janus or a pipe).

    handle(+RequestText, -ResponseText)
    Request:  {"cmd": "new" | "legal" | "play" | "ai" | "hint" | "analyze", ...}
*/
:- module(seega_api, [handle/2, serve_stdio/0]).
% library(json) moved out of library(http/json) in SWI-Prolog 10.
:- if(exists_source(library(json))).
:- use_module(library(json)).
:- else.
:- use_module(library(http/json)).
:- endif.
:- use_module(board).
:- use_module(rules).
:- use_module(eval).
:- use_module(ai).

handle(In, Out) :-
    catch(( atom_json_dict(In, Req, []),
            get_dict(cmd, Req, CmdS),
            atom_string(Cmd, CmdS),
            (   dispatch(Cmd, Req, Resp0)
            ->  put_dict(ok, Resp0, true, Resp)
            ;   Resp = _{ok:false, error:"Request failed (illegal move or bad state)"}
            ) ),
          E,
          ( message_to_codes(E, Msg), Resp = _{ok:false, error:Msg} )),
    with_output_to(string(Out), json_write_dict(current_output, Resp, [width(0)])).

message_to_codes(E, Msg) :- format(string(Msg), "~q", [E]).

%   Line-oriented server: one JSON request per line on stdin.
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

dispatch(new, _, _{state:J, legal:L}) :-
    initial_state(S),
    state_json(S, J),
    legal_json(S, L).

dispatch(legal, Req, _{legal:L}) :-
    req_state(Req, S),
    legal_json(S, L).

dispatch(play, Req, _{state:J, legal:L, captured:Caps, move:MJ, label:Lbl, notes:Notes}) :-
    req_state(Req, S0),
    get_dict(move, Req, MJ0), json_move(MJ0, M),
    req_hist(Req, Hist),
    play_move(S0, M, Hist, S, Caps), !,
    move_json(M, MJ), move_label(M, Lbl),
    state_json(S, J),
    legal_json(S, L),
    move_notes(S0, M, S, Caps, Notes0),
    repetition_note(S, Hist, Notes0, Notes).

dispatch(ai, Req, Resp) :-
    search_request(Req, S0, M, V, Tree, Stats),
    req_hist(Req, Hist),
    play_move(S0, M, Hist, S, Caps), !,
    move_json(M, MJ), move_label(M, Lbl),
    state_json(S, J), legal_json(S, L),
    Resp = _{move:MJ, label:Lbl, score:V, state:J, legal:L,
             captured:Caps, tree:Tree, stats:Stats}.

dispatch(hint, Req, Resp) :-
    search_request(Req, S0, M, V, Tree, Stats),
    apply_move(S0, M, S, Caps), !,
    move_json(M, MJ), move_label(M, Lbl),
    hint_notes(S0, M, S, Caps, V, Notes),
    Resp = _{move:MJ, label:Lbl, score:V, captured:Caps,
             tree:Tree, stats:Stats, notes:Notes}.

dispatch(analyze, Req, Resp) :-
    req_state(Req, S0),
    get_dict(move, Req, MJ0), json_move(MJ0, Played),
    req_int(Req, depth, 2, 1, 4, Depth),
    req_hist(Req, Hist),
    root_move_values(S0, Depth, Hist, Pairs, _),
    Pairs \== [],
    member(PV-Played, Pairs), !,
    max_member(BestV-BestM, Pairs),
    Loss is BestV - PV,
    verdict(Loss, Verdict),
    apply_move(S0, Played, S, Caps), !,
    move_notes(S0, Played, S, Caps, Notes0),
    (   BestM \== Played, Loss > 10
    ->  move_label(BestM, BL),
        apply_move(S0, BestM, _, BCaps), length(BCaps, NB),
        (   NB > 0
        ->  format(string(Better), "Stronger was ~w, which captures ~d piece(s).", [BL, NB])
        ;   format(string(Better), "Stronger was ~w (engine score ~d vs ~d).", [BL, BestV, PV])
        ),
        append(Notes0, [Better], Notes)
    ;   Notes = Notes0
    ),
    move_label(Played, PL), move_label(BestM, BestL),
    move_json(BestM, BestJ),
    length(Pairs, NMoves),
    findall(_{label:ML, score:MV}, ( member(MV-MM, Pairs), move_label(MM, ML) ), Alts0),
    sort(score, @>=, Alts0, Alts),
    Resp = _{verdict:Verdict, played:PL, played_score:PV, best:BestL,
             best_move:BestJ, best_score:BestV, loss:Loss,
             alternatives:NMoves, ranking:Alts, notes:Notes}.

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
req_hist(Req, Hist) :-
    (   get_dict(history, Req, L), is_list(L)
    ->  include(string, L, Hist)
    ;   Hist = []
    ).

%   play_move(+State0, +Move, +History, -State, -Captured)
%   Threefold repetition: when a movement-phase position appears for the
%   third time, the game ends and the side with more pieces wins.
play_move(S0, M, Hist, S, Caps) :-
    apply_move(S0, M, S1, Caps),
    (   state_phase(S1, move),
        state_key(S1, K),
        aggregate_all(count, member(K, Hist), N), N >= 2
    ->  over_by_count(S1, S)
    ;   S = S1
    ).

repetition_note(S, Hist, Notes0, Notes) :-
    (   game_over(S), state_key(S, K), memberchk(K, Hist)
    ->  append(Notes0, ["The same position appeared three times, so the game ends on piece count."], Notes)
    ;   Notes = Notes0
    ).

req_int(Req, Key, Default, Lo, Hi, V) :-
    (   get_dict(Key, Req, V0), integer(V0) -> true ; V0 = Default ),
    V is max(Lo, min(Hi, V0)).

verdict(Loss, "best")        :- Loss =< 10, !.
verdict(Loss, "good")        :- Loss =< 60, !.
verdict(Loss, "inaccuracy")  :- Loss =< 150, !.
verdict(Loss, "mistake")     :- Loss =< 400, !.
verdict(_,    "blunder").

                 /*******************************
                 *     EXPLANATIONS (COACH)     *
                 *******************************/

move_notes(S0, M, S, Caps, Notes) :-
    state_turn(S0, P),
    findall(N, note(S0, M, S, Caps, P, N), Notes).

note(_, _, _, Caps, _, N) :-
    Caps \== [],
    maplist(square_name, Caps, Names),
    atomic_list_concat(Names, ', ', NS),
    length(Caps, K),
    format(string(N), "Captured ~d piece(s) at ~w by custodian (sandwich) capture.", [K, NS]).
note(_, _, S, _, P, "Capture chain: your piece can capture again, so you move it once more (or stop).") :-
    state_phase(S, move), state_turn(S, P), arg(7, S, Ch), Ch \== none.
note(_, M, _, _, _, "Corner pieces can never be captured: there is no square beyond them to sandwich against.") :-
    target(M, T), corner(T).
note(_, move(_, T), _, _, _, "The centre square is a safe haven: a piece standing there is immune to capture.") :-
    centre(T).
note(_, drop(I), _, _, _, "Squares next to the centre matter: the first move of the movement phase must slide into the centre.") :-
    adj(I, _, C), centre(C).
note(_, _, S, _, P, N) :-
    state_phase(S, move), other(P, O), state_turn(S, O),
    state_board(S, B), threats(B, O, K), K > 0,
    format(string(N), "Careful: your opponent can now capture ~d of your pieces next move.", [K]).
note(_, _, S, _, P, N) :-
    state_phase(S, move), state_turn(S, P), arg(10, S, true),
    N = "Your opponent is completely blocked, so you take an extra turn.".
note(_, _, S, _, _, N) :-
    game_over(S), arg(9, S, W),
    (   W == draw -> N = "Game over: draw."
    ;   format(string(N), "Game over: ~w wins.", [W])
    ).
note(S0, drop(_), S, _, _, "All 24 pieces are placed: the movement phase begins, black moves first.") :-
    state_phase(S0, drop), \+ state_phase(S, drop).

target(drop(I), I).
target(move(_, T), T).

hint_notes(S0, M, S, Caps, V, [Head|Rest]) :-
    move_label(M, L),
    format(string(Head), "Engine suggests ~w (evaluation ~d for you).", [L, V]),
    move_notes(S0, M, S, Caps, Rest).

                 /*******************************
                 *        STATE <-> JSON        *
                 *******************************/

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

none_null(none, null) :- !.
none_null(X, X).
null_none(null, none) :- !.
null_none(X, X).

json_move(J, M) :-
    get_dict(type, J, TS), atom_string(Type, TS),
    (   Type == drop -> M = drop(J.to)
    ;   Type == move -> M = move(J.from, J.to)
    ;   Type == stop -> M = stop
    ).

legal_json(S, L) :-
    legal_moves(S, Ms),
    findall(J, ( member(M, Ms), move_json(M, J0), move_label(M, Lb), J = J0.put(label, Lb) ), L).
