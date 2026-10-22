/*  rules.pl -- Seega game rules.

    State term:
        s(Board, Phase, Turn, HandW, HandB, DropsLeft, Chain, NoCapture, Winner, Extra)

      Phase      drop | move | over
      Turn       w | b  (side to move)
      HandW/B    pieces still to be dropped
      DropsLeft  drops remaining in the current drop turn (2 per turn)
      Chain      none | Index of the piece that must continue capturing
      NoCapture  consecutive movement turns without a capture
      Winner     none | w | b | draw
      Extra      true when Turn is moving again because the opponent is blocked

    Moves:  drop(I)   move(From, To)   stop  (end a capture chain)
*/
:- module(rules,
          [ initial_state/1,
            legal_moves/2,
            apply_move/4,
            slide_moves/3,
            captures_for/4,
            move_captures/5,
            can_capture_from/3,
            threats/3,
            game_over/1,
            state_turn/2,
            state_board/2,
            state_phase/2,
            pieces_per_player/1,
            max_quiet_moves/1,
            over_by_count/2
          ]).
:- use_module(board).

pieces_per_player(12).
drops_per_turn(2).
max_quiet_moves(50).

initial_state(s(B, drop, w, N, N, D, none, 0, none, false)) :-
    pieces_per_player(N),
    drops_per_turn(D),
    empty_board(B).

state_board(S, B)  :- arg(1, S, B).
state_phase(S, P)  :- arg(2, S, P).
state_turn(S, T)   :- arg(3, S, T).
game_over(S)       :- state_phase(S, over).

hand(w, HW, _, HW).
hand(b, _, HB, HB).

dec_hand(w, HW0, HB, HW, HB) :- HW is HW0 - 1.
dec_hand(b, HW, HB0, HW, HB) :- HB is HB0 - 1.

                 /*******************************
                 *          MOVE GENERATION     *
                 *******************************/

legal_moves(s(_, over, _, _, _, _, _, _, _, _), []) :- !.
legal_moves(s(B, drop, _, _, _, _, _, _, _, _), Moves) :- !,
    findall(drop(I), ( cell(I, B, e), \+ centre(I) ), Moves).
legal_moves(s(B, move, T, _, _, _, none, _, _, _), Moves) :- !,
    slide_moves(B, T, Moves).
legal_moves(s(B, move, T, _, _, _, P, _, _, _), Moves) :-
    findall(move(P, J),
            ( adj(P, _, J), cell(J, B, e),
              move_captures(B, T, P, J, [_|_]) ),
            Caps),
    append(Caps, [stop], Moves).

%   slide_moves(+Board, +Player, -Moves): one orthogonal step into an empty square.
slide_moves(B, T, Moves) :-
    findall(move(I, J), ( cell(I, B, T), adj(I, _, J), cell(J, B, e) ), Moves).

%   captures_for(+Board, +Player, +To, -Captured)
%   Custodian capture: an enemy piece next to To is taken when the square
%   beyond it (same line) holds a friendly piece. The centre is immune.
captures_for(B, T, To, Caps) :-
    other(T, O),
    findall(N,
            ( adj(To, D, N), cell(N, B, O), \+ centre(N),
              adj(N, D, N2), cell(N2, B, T) ),
            Caps).

%   move_captures(+Board, +Player, +From, +To, -Captured)
move_captures(B0, T, F, To, Caps) :-
    set_cell(F, e, B0, B1),
    set_cell(To, T, B1, B2),
    captures_for(B2, T, To, Caps).

can_capture_from(B, T, P) :-
    adj(P, _, J), cell(J, B, e),
    move_captures(B, T, P, J, [_|_]), !.

%   threats(+Board, +Player, -N): distinct enemy pieces Player could capture
%   with a single move from this position.
threats(B, T, N) :-
    slide_moves(B, T, Moves),
    findall(C, ( member(move(F, To), Moves),
                 move_captures(B, T, F, To, Cs),
                 member(C, Cs) ),
            All),
    sort(All, Set),
    length(Set, N).

                 /*******************************
                 *          APPLY A MOVE        *
                 *******************************/

%   apply_move(+State0, +Move, -State, -Captured)
apply_move(S0, M, S, Caps) :-
    apply_move_(S0, M, S, Caps), !.

apply_move_(s(B0, drop, T, HW0, HB0, DL0, Ch, NC, W, _), drop(I), S, []) :-
    cell(I, B0, e), \+ centre(I),
    hand(T, HW0, HB0, H), H > 0,
    set_cell(I, T, B0, B),
    dec_hand(T, HW0, HB0, HW, HB),
    DL1 is DL0 - 1,
    drops_per_turn(DPT),
    (   HW =:= 0, HB =:= 0
    ->  % The second player (black) dropped last and opens the movement phase.
        resolve_turn(s(B, move, b, 0, 0, 0, none, 0, W, false), S)
    ;   DL1 =:= 0
    ->  other(T, O), S = s(B, drop, O, HW, HB, DPT, Ch, NC, W, false)
    ;   S = s(B, drop, T, HW, HB, DL1, Ch, NC, W, false)
    ).
apply_move_(s(B0, move, T, HW, HB, DL, Ch, NC0, W, _), move(F, To), S, Caps) :-
    cell(F, B0, T), adj(F, _, To), cell(To, B0, e),
    ( Ch == none -> true ; F == Ch ),
    move_captures(B0, T, F, To, Caps),
    ( Ch == none -> true ; Caps \== [] ),
    set_cell(F, e, B0, B1),
    set_cell(To, T, B1, B2),
    remove_pieces(Caps, B2, B),
    ( Caps == [] -> NC is NC0 + 1 ; NC = 0 ),
    other(T, O),
    (   Caps \== [],
        piece_count(B, O, NO), NO > 0,
        can_capture_from(B, T, To)
    ->  % Multi-capture chain: the same piece may keep capturing.
        S = s(B, move, T, HW, HB, DL, To, NC, W, false)
    ;   end_turn(s(B, move, T, HW, HB, DL, none, NC, W, false), S)
    ).
apply_move_(s(B, move, T, HW, HB, DL, Ch, NC, W, _), stop, S, []) :-
    Ch \== none,
    end_turn(s(B, move, T, HW, HB, DL, none, NC, W, false), S).

remove_pieces([], B, B).
remove_pieces([I|Is], B0, B) :-
    set_cell(I, e, B0, B1),
    remove_pieces(Is, B1, B).

end_turn(s(B, move, T, HW, HB, DL, _, NC, W, _), S) :-
    other(T, O),
    resolve_turn(s(B, move, O, HW, HB, DL, none, NC, W, false), S).

%   resolve_turn(+State0, -State)
%   Decide whether the game is over and handle a blocked side to move:
%   if T cannot move but the opponent can, the opponent takes an extra turn.
resolve_turn(S0, S) :-
    S0 = s(B, move, T, HW, HB, DL, _, NC, _, _),
    other(T, O),
    piece_count(B, T, NT),
    piece_count(B, O, NO),
    max_quiet_moves(Max),
    (   NT =:= 0                -> S = s(B, over, T, HW, HB, DL, none, NC, O, false)
    ;   NO =:= 0                -> S = s(B, over, T, HW, HB, DL, none, NC, T, false)
    ;   NC >= Max               -> winner_by_count(B, W), S = s(B, over, T, HW, HB, DL, none, NC, W, false)
    ;   slide_moves(B, T, [_|_]) -> S = S0
    ;   slide_moves(B, O, [_|_]) -> S = s(B, move, O, HW, HB, DL, none, NC, none, true)
    ;   winner_by_count(B, W), S = s(B, over, T, HW, HB, DL, none, NC, W, false)
    ).

winner_by_count(B, W) :-
    piece_count(B, w, NW),
    piece_count(B, b, NB),
    (   NW > NB -> W = w
    ;   NB > NW -> W = b
    ;   W = draw
    ).

%   over_by_count(+State0, -State): end the game, more pieces wins.
over_by_count(s(B, _, T, HW, HB, DL, _, NC, _, _), s(B, over, T, HW, HB, DL, none, NC, W, false)) :-
    winner_by_count(B, W).
