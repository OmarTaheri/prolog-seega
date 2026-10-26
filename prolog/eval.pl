/*  eval.pl -- Static evaluation of a Seega position.

    WHAT THIS FILE DOES
    -------------------
    The AI cannot search until the end of the game (far too many moves),
    so at some depth it stops and GUESSES how good the position is.
    That guess is the "heuristic evaluation": one number.

    Scores are from the point of view of Player (positive = good for Player).
    The same position gets +50 for white and -50 for black.

    The score is a sum of 4 ideas (each = mine minus the opponent's):
      material   100 per piece (on board + in hand)
                 -> having more stones is the most important thing
      safety     corners can never be captured, the centre is immune,
                 edge pieces can only be captured along the edge
                 -> stones on safe squares are worth a bit more
      mobility   number of legal slides (movement phase)
                 -> more moves = less chance of being blocked
      threats    enemy pieces capturable next move, weighted by side to move
                 -> if it is MY turn, my threats are real (I can play them now),
                    so they count more than the opponent's
*/
:- module(eval, [evaluate/4, win_score/1]).
:- use_module(board).
:- use_module(rules).

%   A win is worth much more than any normal position (12 stones * 100 = 1200),
%   so the AI always prefers a real win over a "good-looking" position.
win_score(10000).

/*  evaluate(+State, +Player, +DepthLeft, -Score)

    Clause 1: the game is over -> exact score, no guessing.
      win  =  10000 + DepthLeft
      loss = -10000 - DepthLeft
      draw =  0
    TRICK: adding DepthLeft. A win found early in the search still has a lot
    of depth left, so it scores higher -> the AI picks the FASTEST win.
    For a loss it is the other way round -> the AI delays losing as long as
    possible (gives the opponent more chances to make a mistake).

    The cut (!) after game_over(S) makes sure clause 2 is not also tried
    for a finished game.
*/
evaluate(S, P, D, V) :-
    game_over(S), !,
    arg(9, S, W),                   % argument 9 of the state is the Winner
    win_score(Win),
    (   W == P    -> V is Win + D
    ;   W == draw -> V = 0
    ;   V is -Win - D
    ).
%   Clause 2: normal position -> add up the 4 ideas.
evaluate(S, P, _, V) :-
    S = s(B, Phase, T, HW, HB, _, _, _, _, _),     % take the fields we need out of the state
    other(P, O),
    % material: stones on the board + stones still in hand
    piece_count(B, P, NP), piece_count(B, O, NO),
    hand_of(P, HW, HB, HP), hand_of(O, HW, HB, HO),
    Material is 100 * ((NP + HP) - (NO + HO)),
    % safety: value of the squares my stones stand on
    safety(B, P, Phase, SP), safety(B, O, Phase, SO),
    (   Phase == move
    ->  % mobility: 4 points for each extra move I have
        slide_moves(B, P, MP), length(MP, LP),
        slide_moves(B, O, MO), length(MO, LO),
        Mobility is 4 * (LP - LO),
        % threats: the side to move gets 45 per threat, the other side 25
        threats(B, P, TP), threats(B, O, TO),
        (   T == P
        ->  Threat is 45*TP - 25*TO
        ;   Threat is 25*TP - 45*TO
        )
    ;   % in the drop phase nothing can move yet, so these are 0
        Mobility = 0,
        Threat = 0
    ),
    V is Material + (SP - SO) + Mobility + Threat.

%   hand_of(Player, HandW, HandB, Hand): same idea as hand/4 in rules.pl.
hand_of(w, HW, _, HW).
hand_of(b, _, HB, HB).

%   safety(+Board, +Player, +Phase, -Score): add the square value of every
%   stone of Player. aggregate_all(sum(V), Goal, Total) adds V over every
%   solution of Goal (like a SQL SUM).
safety(B, P, Phase, Score) :-
    aggregate_all(sum(V), ( cell(I, B, P), square_value(I, Phase, V) ), Score).

/*  square_value(+Square, +Phase, -Value): how safe/useful a square is.
    TRICK: ordered clauses + cut = a priority list. Prolog tries them top
    to bottom; the first one that matches cuts away the rest, and the last
    clause is the "default" (0 points).
      corner           12  never capturable (nothing beyond it to sandwich with)
      centre (move)    15  immune to capture in the move phase
      edge              4  can only be captured along the edge
      next to centre    2  (drop phase) the first slide must go into the centre,
                           so these squares decide who gets it
*/
square_value(I, _, 12)     :- corner(I), !.
square_value(I, move, 15)  :- centre(I), !.
square_value(I, _, 4)      :- edge(I), !.
square_value(I, drop, 2)   :- adj(I, _, C), centre(C), !.
square_value(_, _, 0).
