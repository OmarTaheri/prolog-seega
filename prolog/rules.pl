/*  rules.pl -- Seega game rules.

    WHAT THIS FILE DOES
    -------------------
    Everything about "what is allowed" and "what happens after a move":
      * which moves are legal           -> legal_moves/2
      * how a move changes the game     -> apply_move/4
      * captures, chains, blocked turns, end of the game

    THE GAME STATE
    --------------
    The whole game at one moment is ONE term with 10 arguments:

        s(Board, Phase, Turn, HandW, HandB, DropsLeft, Chain, NoCapture, Winner, Extra)

      Board      the b/25 term from board.pl
      Phase      drop | move | over
                   drop = players are still placing stones
                   move = stones slide around and capture
                   over = the game has ended
      Turn       w | b  (whose turn it is)
      HandW/B    how many stones white/black still have to place
      DropsLeft  how many stones the current player may still drop this turn
                 (each turn you drop 2, so it goes 2 -> 1 -> next player)
      Chain      none, or the square of the stone that is in the middle of
                 a capture chain (only that stone may move now)
      NoCapture  how many moves in a row happened without any capture
      Winner     none | w | b | draw
      Extra      true when Turn is playing again because the opponent is blocked

    The state is never changed: every move builds a NEW state term
    (this is normal in Prolog, variables cannot be overwritten).

    MOVES are small terms:
        drop(I)        place a stone on square I        (drop phase)
        move(From, To) slide a stone one square         (move phase)
        stop           end a capture chain voluntarily  (move phase)
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

%   The numbers of the game, written as facts so they are easy to find and change.
pieces_per_player(12).      % 12 stones each -> 24 stones fill the board except the centre
drops_per_turn(2).          % RULE: each turn you place TWO stones
max_quiet_moves(50).        % RULE: 50 moves with no capture ends the game

%   initial_state(-S): empty board, drop phase, white starts, 12 stones in
%   each hand, 2 drops for this turn, no chain, nothing counted, no winner.
initial_state(s(B, drop, w, N, N, D, none, 0, none, false)) :-
    pieces_per_player(N),
    drops_per_turn(D),
    empty_board(B).

%   Getters: take one field out of the state.
%   arg(N, Term, X) gives the N-th argument of a term, so arg(1, S, B) is the board.
state_board(S, B)  :- arg(1, S, B).
state_phase(S, P)  :- arg(2, S, P).
state_turn(S, T)   :- arg(3, S, T).
game_over(S)       :- state_phase(S, over).

%   hand(Player, HandW, HandB, Hand): pick the hand of the given player.
%   TRICK: pattern matching instead of if-then-else. The first argument
%   (w or b) decides which clause runs. Prolog also indexes on the first
%   argument, so it jumps straight to the right clause.
hand(w, HW, _, HW).
hand(b, _, HB, HB).

%   dec_hand: take one stone out of the hand of the player who dropped.
dec_hand(w, HW0, HB, HW, HB) :- HW is HW0 - 1.
dec_hand(b, HW, HB0, HW, HB) :- HB is HB0 - 1.

                 /*******************************
                 *          MOVE GENERATION     *
                 *******************************/

/*  legal_moves(+State, -Moves): the list of every move allowed right now.

    One clause per situation. Each clause starts with a pattern on the
    state, and the cut (!) says "this is the right case, do not try the
    clauses below". Without the cuts, Prolog could also try the later
    clauses on backtracking and give wrong extra answers.

    Situation 1: game over                 -> no moves.
    Situation 2: drop phase                -> RULE: any empty square
                                              EXCEPT the centre (12).
    Situation 3: move phase, no chain      -> every normal slide.
    Situation 4: move phase, in a chain    -> RULE: only the chain stone
                                              may move, only moves that
                                              capture again, plus "stop".
*/
legal_moves(s(_, over, _, _, _, _, _, _, _, _), []) :- !.
legal_moves(s(B, drop, _, _, _, _, _, _, _, _), Moves) :- !,
    findall(drop(I), ( cell(I, B, e), \+ centre(I) ), Moves).   % empty and not the centre
legal_moves(s(B, move, T, _, _, _, none, _, _, _), Moves) :- !,
    slide_moves(B, T, Moves).
legal_moves(s(B, move, T, _, _, _, P, _, _, _), Moves) :-
    % P is the chain stone. [_|_] means "a list with at least one element",
    % so this keeps only moves that capture something.
    findall(move(P, J),
            ( adj(P, _, J), cell(J, B, e),
              move_captures(B, T, P, J, [_|_]) ),
            Caps),
    append(Caps, [stop], Moves).     % the player may always stop the chain

/*  slide_moves(+Board, +Player, -Moves)
    RULE: a stone moves ONE square up, down, left or right into an EMPTY
    square. No jumping, no diagonals.

        . w .          w on square I, J is a neighbour (adj) and empty (e)
        . . .    ->    so move(I, J) is legal

    Read the findall like a sentence: "collect move(I,J) for every square I
    that holds my stone, every neighbour J of I, where J is empty".
*/
slide_moves(B, T, Moves) :-
    findall(move(I, J), ( cell(I, B, T), adj(I, _, J), cell(J, B, e) ), Moves).

/*  captures_for(+Board, +Player, +To, -Captured)
    RULE: custodian capture ("sandwich").
    After my stone lands on To, look in each of the 4 directions:

        To   N    N2
       [ w ][ b ][ w ]   -> the black stone on N is captured
       (me) (enemy)(me)

      * N  is the neighbour of To in direction D, and holds an enemy (O)
      * N2 is the next square in the SAME direction D, and holds my stone (T)
      * RULE: the centre square is a safe haven, a stone on 12 is never captured
              (that is the  \+ centre(N)  check)

    Because findall tries all 4 directions, one move can capture in several
    directions at once (RULE: multi-capture).

    Note: only the stone that MOVED captures. If I move between two enemies
    ( b w b ), nothing happens to me (RULE: moving between two enemies is
    safe), because captures are only checked around the stone that moved,
    and only for enemy stones.
*/
captures_for(B, T, To, Caps) :-
    other(T, O),
    findall(N,
            ( adj(To, D, N), cell(N, B, O), \+ centre(N),
              adj(N, D, N2), cell(N2, B, T) ),        % same direction D twice = straight line
            Caps).

%   move_captures(+Board, +Player, +From, +To, -Captured)
%   "If I play From -> To, what would I capture?"
%   We build the board after the slide (From empty, To mine) and then check
%   for sandwiches. The real board is not changed (set_cell makes copies).
move_captures(B0, T, F, To, Caps) :-
    set_cell(F, e, B0, B1),
    set_cell(To, T, B1, B2),
    captures_for(B2, T, To, Caps).

%   can_capture_from(+Board, +Player, +Square): can the stone on Square
%   capture with its next step? Used for capture chains.
%   The cut (!) at the end stops after the FIRST capture found, we only
%   need "yes or no", not all the ways.
can_capture_from(B, T, P) :-
    adj(P, _, J), cell(J, B, e),
    move_captures(B, T, P, J, [_|_]), !.

/*  threats(+Board, +Player, -N): how many DIFFERENT enemy stones Player
    could capture with one move. Used by the evaluation (eval.pl).
    TRICK: sort/2 removes duplicates, so a stone that can be captured in
    two different ways is only counted once.
*/
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

/*  apply_move(+State0, +Move, -State, -Captured)
    Play Move in State0 and give the new State and the list of captured squares.
    It FAILS if the move is not legal (so it also works as a legality check).

    TRICK: a wrapper with a cut. The real work is in apply_move_/4.
    The ! after it means: "once we found the result, forget any other way
    to prove it". Without it, Prolog would keep "choicepoints" (leftover
    alternatives) after every move. In a search of thousands of moves this
    wastes memory and time, so we make the predicate deterministic.
*/
apply_move(S0, M, S, Caps) :-
    apply_move_(S0, M, S, Caps), !.

/*  Case 1: dropping a stone (drop phase).
    RULES:
      * the square must be empty and not the centre
      * the player must still have stones in hand
      * each turn = 2 drops. DropsLeft counts down 2 -> 1 -> 0;
        at 0 the turn passes to the other player.
      * when both hands are empty (all 24 stones placed) the MOVE phase
        starts and BLACK moves first (black dropped last, white dropped first).
    No captures happen while dropping, so Captured is always [].

    TRICK: the chain ( C1 -> A1 ; C2 -> A2 ; A3 ) is if / else if / else.
*/
apply_move_(s(B0, drop, T, HW0, HB0, DL0, Ch, NC, W, _), drop(I), S, []) :-
    cell(I, B0, e), \+ centre(I),                 % empty and not the centre
    hand(T, HW0, HB0, H), H > 0,                  % still have a stone to place
    set_cell(I, T, B0, B),
    dec_hand(T, HW0, HB0, HW, HB),
    DL1 is DL0 - 1,
    drops_per_turn(DPT),
    (   HW =:= 0, HB =:= 0
    ->  % The second player (black) dropped last and opens the movement phase.
        resolve_turn(s(B, move, b, 0, 0, 0, none, 0, W, false), S)
    ;   DL1 =:= 0
    ->  % second drop done: the other player starts their 2 drops
        other(T, O), S = s(B, drop, O, HW, HB, DPT, Ch, NC, W, false)
    ;   % first drop done: same player drops once more
        S = s(B, drop, T, HW, HB, DL1, Ch, NC, W, false)
    ).

/*  Case 2: sliding a stone (move phase).
    Steps:
      1. check it is legal: my stone on F, To is a neighbour and empty
      2. if we are in a chain, only the chain stone (Ch) may move,
         and the move MUST capture
      3. find the captures, move the stone, remove the captured stones
      4. count quiet moves: no capture -> NoCapture + 1, capture -> back to 0
      5. RULE (capture chain): if I captured, the enemy still has stones, and
         the same stone can capture AGAIN, it is still my turn and Chain = To.
         Otherwise the turn ends normally.

        before          after w moves right       chain: w can capture again
        w . b w         . w . w   (b captured)    -> still white's turn
*/
apply_move_(s(B0, move, T, HW, HB, DL, Ch, NC0, W, _), move(F, To), S, Caps) :-
    cell(F, B0, T), adj(F, _, To), cell(To, B0, e),     % step 1
    ( Ch == none -> true ; F == Ch ),                   % step 2: chain stone only
    move_captures(B0, T, F, To, Caps),
    ( Ch == none -> true ; Caps \== [] ),               % step 2: chain move must capture
    set_cell(F, e, B0, B1),                             % step 3
    set_cell(To, T, B1, B2),
    remove_pieces(Caps, B2, B),
    ( Caps == [] -> NC is NC0 + 1 ; NC = 0 ),           % step 4
    other(T, O),
    (   Caps \== [],                                    % step 5
        piece_count(B, O, NO), NO > 0,
        can_capture_from(B, T, To)
    ->  % Multi-capture chain: the same piece may keep capturing.
        S = s(B, move, T, HW, HB, DL, To, NC, W, false)
    ;   end_turn(s(B, move, T, HW, HB, DL, none, NC, W, false), S)
    ).

/*  Case 3: "stop" -- only allowed in the middle of a chain (Ch \== none).
    RULE: continuing a chain is optional, the player may stop and the turn
    passes to the opponent.
*/
apply_move_(s(B, move, T, HW, HB, DL, Ch, NC, W, _), stop, S, []) :-
    Ch \== none,
    end_turn(s(B, move, T, HW, HB, DL, none, NC, W, false), S).

%   remove_pieces(+Squares, +Board0, -Board): empty every captured square.
%   Classic recursion on a list: empty list = done (base case), otherwise
%   handle the head and recurse on the tail, passing the board along.
remove_pieces([], B, B).
remove_pieces([I|Is], B0, B) :-
    set_cell(I, e, B0, B1),
    remove_pieces(Is, B1, B).

%   end_turn: give the turn to the opponent, then let resolve_turn check
%   if the game ended or if the opponent is blocked.
end_turn(s(B, move, T, HW, HB, DL, _, NC, W, _), S) :-
    other(T, O),
    resolve_turn(s(B, move, O, HW, HB, DL, none, NC, W, false), S).

/*  resolve_turn(+State0, -State)
    Called every time a new player is about to move. Checked in this order
    (the first true line wins, like if / else if):

      1. RULE: the player to move has no stones left   -> opponent wins
      2. RULE: the opponent has no stones left          -> player wins
      3. RULE: 50 moves without a capture               -> more stones wins
      4. the player can slide at least one stone        -> normal turn
      5. RULE (blocked player): the player cannot move but the opponent
         can -> the OPPONENT plays again (an extra turn, Extra = true)
      6. nobody can move at all                         -> more stones wins

    Example of a blocked player (black in the corner, every neighbour full):
        b w .
        w . .      black has no empty square next to it -> white moves again
*/
resolve_turn(S0, S) :-
    S0 = s(B, move, T, HW, HB, DL, _, NC, _, _),
    other(T, O),
    piece_count(B, T, NT),
    piece_count(B, O, NO),
    max_quiet_moves(Max),
    (   NT =:= 0                -> S = s(B, over, T, HW, HB, DL, none, NC, O, false)      % 1
    ;   NO =:= 0                -> S = s(B, over, T, HW, HB, DL, none, NC, T, false)      % 2
    ;   NC >= Max               -> winner_by_count(B, W), S = s(B, over, T, HW, HB, DL, none, NC, W, false)  % 3
    ;   slide_moves(B, T, [_|_]) -> S = S0                                                % 4
    ;   slide_moves(B, O, [_|_]) -> S = s(B, move, O, HW, HB, DL, none, NC, none, true)   % 5
    ;   winner_by_count(B, W), S = s(B, over, T, HW, HB, DL, none, NC, W, false)          % 6
    ).

%   winner_by_count(+Board, -Winner): the side with more stones wins,
%   equal numbers = draw. Used when the game ends without a full wipe-out.
winner_by_count(B, W) :-
    piece_count(B, w, NW),
    piece_count(B, b, NB),
    (   NW > NB -> W = w
    ;   NB > NW -> W = b
    ;   W = draw
    ).

%   over_by_count(+State0, -State): end the game, more pieces wins.
%   Used by api.pl for the threefold-repetition rule.
over_by_count(s(B, _, T, HW, HB, DL, _, NC, _, _), s(B, over, T, HW, HB, DL, none, NC, W, false)) :-
    winner_by_count(B, W).
