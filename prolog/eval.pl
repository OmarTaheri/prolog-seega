/*  eval.pl -- Static evaluation of a Seega position.

    Scores are from the point of view of Player (positive = good for Player).
    Terms:
      material   100 per piece (on board + in hand)
      safety     corners can never be captured, the centre is immune,
                 edge pieces can only be captured along the edge
      mobility   number of legal slides (movement phase)
      threats    enemy pieces capturable next move, weighted by side to move
*/
:- module(eval, [evaluate/4, win_score/1]).
:- use_module(board).
:- use_module(rules).

win_score(10000).

%   evaluate(+State, +Player, +DepthLeft, -Score)
%   DepthLeft rewards faster wins and slower losses.
evaluate(S, P, D, V) :-
    game_over(S), !,
    arg(9, S, W),
    win_score(Win),
    (   W == P    -> V is Win + D
    ;   W == draw -> V = 0
    ;   V is -Win - D
    ).
evaluate(S, P, _, V) :-
    S = s(B, Phase, T, HW, HB, _, _, _, _, _),
    other(P, O),
    piece_count(B, P, NP), piece_count(B, O, NO),
    hand_of(P, HW, HB, HP), hand_of(O, HW, HB, HO),
    Material is 100 * ((NP + HP) - (NO + HO)),
    safety(B, P, Phase, SP), safety(B, O, Phase, SO),
    (   Phase == move
    ->  slide_moves(B, P, MP), length(MP, LP),
        slide_moves(B, O, MO), length(MO, LO),
        Mobility is 4 * (LP - LO),
        threats(B, P, TP), threats(B, O, TO),
        (   T == P
        ->  Threat is 45*TP - 25*TO
        ;   Threat is 25*TP - 45*TO
        )
    ;   Mobility = 0,
        Threat = 0
    ),
    V is Material + (SP - SO) + Mobility + Threat.

hand_of(w, HW, _, HW).
hand_of(b, _, HB, HB).

safety(B, P, Phase, Score) :-
    aggregate_all(sum(V), ( cell(I, B, P), square_value(I, Phase, V) ), Score).

square_value(I, _, 12)     :- corner(I), !.
square_value(I, move, 15)  :- centre(I), !.
square_value(I, _, 4)      :- edge(I), !.
square_value(I, drop, 2)   :- adj(I, _, C), centre(C), !.
square_value(_, _, 0).
