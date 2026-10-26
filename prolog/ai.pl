/*  ai.pl -- Minimax search with alpha-beta pruning.

    WHAT THIS FILE DOES
    -------------------
    It chooses the AI's move, and while doing that it records the search
    tree so the website can draw it.

    MINIMAX IN PLAIN WORDS
    ----------------------
    Try every move, then every answer of the opponent, then every answer to
    that, ... down to a fixed Depth. At the bottom, score the positions with
    evaluate/4 (eval.pl). Then go back up:
      * at MY turn (MAX node)       I pick the child with the HIGHEST score
      * at the OPPONENT's turn (MIN) they pick the child with the LOWEST score
    The value that comes back to the root tells me which move is best,
    assuming the opponent also plays well.

    ALPHA-BETA IN PLAIN WORDS
    -------------------------
    Alpha (A) = the best score MAX is already sure to get somewhere else.
    Beta  (B) = the best score MIN is already sure to get somewhere else.
    If at some node A >= B, the players will never let the game reach this
    node (one of them already has a better option earlier), so the
    remaining moves here do not need to be searched: they are PRUNED.
    The result is the same as plain minimax, just much faster.

    The side to move at the root is the maximising player. Because a turn
    does not always alternate (two drops per turn, capture chains, extra
    turns for a blocked opponent), every node decides max/min by asking
    whose turn it is, rather than by depth parity.
    (In chess you can say "even depth = me, odd depth = opponent".
     In Seega that is wrong: after my first drop it is STILL my turn.)

    While searching, the engine records the search tree (down to
    ShowDepth plies) so the frontend can draw it:

      status  root      the current position
              best      on the principal variation chosen by the engine
              explored  searched internal node
              leaf      evaluated by the heuristic (depth limit / game end)
              pruned    never searched: cut off by an alpha-beta bound
              repeat    repeats an earlier position: penalised, not searched
*/
:- module(ai,
          [ best_move/7,
            best_move/8,
            state_key/2,
            move_json/2,
            move_label/2,
            inf/1
          ]).
:- use_module(board).
:- use_module(rules).
:- use_module(eval).

%   "Infinity": a number bigger than any real score. Alpha starts at -inf
%   and Beta at +inf (we know nothing yet).
inf(1000000).

%   Repeating an earlier position costs the side that makes the repetition,
%   so two engines cannot shuffle the same pieces back and forth forever.
%   (Without this, AI vs AI could move a stone back and forth forever,
%    because both sides think the position is "fine".)
contempt(40).

%   state_key(+State, -Key): identifies a position (board + side to move).
%   Example key: "eewb...e" + "w" -> "eewb...ew". Two positions are the same
%   if their keys are equal. Used to detect repeated positions.
state_key(S, K) :-
    state_board(S, B), board_string(B, BS),
    state_turn(S, T),
    string_concat(BS, T, K).

%   best_move(+State, +Depth, +ShowDepth, -Move, -Value, -Tree, -Stats)
%   Same as best_move/8 with an empty history (used by the tests).
best_move(S, Depth, ShowDepth, Move, Value, Tree, Stats) :-
    best_move(S, Depth, ShowDepth, [], Move, Value, Tree, Stats).

/*  best_move(+State, +Depth, +ShowDepth, +History, -Move, -Value, -Tree, -Stats)
    History: keys of the positions already seen in this game.
    This is the entry point the API calls. It:
      1. resets the counters
      2. runs alpha-beta from the root with the window (-inf, +inf)
      3. marks the root and the best path in the tree
      4. returns statistics (nodes, pruned, leaves, time)

    TRICK: flag/3 = a global counter. flag(Name, Old, New) reads the old
    value and stores the new one. Prolog variables cannot be changed, and
    passing counters through every call would add many arguments, so for
    simple statistics a global counter is easier.
      flag(ab_nodes, _, 0)        -> set to 0
      flag(ab_nodes, N0, N0 + 1)  -> add 1
      flag(ab_nodes, N, N)        -> just read it
*/
best_move(S, Depth, ShowDepth, Hist, Move, Value, Tree, Stats) :-
    state_turn(S, P),                        % P = the player the AI plays for (MAX)
    inf(Inf), NInf is -Inf,
    flag(ab_nodes, _, 0), flag(ab_pruned, _, 0),
    flag(ab_leaves, _, 0), flag(ab_id, _, 0),
    statistics(cputime, T0),
    state_key(S, K0),
    ab(S, Depth, NInf, Inf, P, ShowDepth, 0, [K0|Hist], Value, Move, Root0),
    statistics(cputime, T1),
    Ms is round((T1 - T0) * 1000),           % seconds -> milliseconds
    flag(ab_nodes, N, N), flag(ab_pruned, Pr, Pr), flag(ab_leaves, L, L),
    put_dict(status, Root0, root, Root1),    % the top node is shown as "root"
    mark_path(Root1, Tree),
    % _{key:value, ...} is an SWI-Prolog DICT (like a JSON object / Python dict).
    % It is turned into JSON directly for the website.
    Stats = _{nodes:N, pruned:Pr, leaves:L, time_ms:Ms, depth:Depth, show_depth:ShowDepth}.

/*  ab(+State, +Depth, +Alpha, +Beta, +Player, +ShowDepth, +Ply, +Seen, -Value, -BestMove, -Node)
    The alpha-beta search of ONE node.
      Depth      how many more plies we may search (stops at 0)
      Player     the root player (MAX); never changes during the search
      ShowDepth  how many more plies are drawn in the tree (stops at -1)
      Ply        how deep this node is (root = 0), shown on the website
      Seen       keys of positions on the path + game history (repetitions)
      Node       the tree node (a dict), or the atom none when not drawn

    Two cases:
      LEAF: depth used up, game over, or no legal move
            -> score with evaluate/4 (the heuristic)
      INNER NODE: generate the moves, sort them (good ones first) and let
            loop/18 search them one by one.
*/
ab(S, D, A, B, P, TD, Ply, H, V, Best, Node) :-
    flag(ab_nodes, N0, N0 + 1),
    flag(ab_id, Id, Id + 1),                 % unique id for the website
    state_turn(S, T),
    ( T == P -> IsMax = true ; IsMax = false ),   % MAX if it is the AI's turn
    (   ( D =< 0 ; game_over(S) ; legal_moves(S, []) )
    ->  % LEAF
        evaluate(S, P, D, V),
        flag(ab_leaves, L, L + 1),
        Best = none, BI = -1, Kids = [], Status = leaf
    ;   % INNER NODE
        legal_moves(S, Ms0),
        order_moves(S, Ms0, Ms),
        inf(Inf),
        % start value: MAX starts from -inf (anything is better),
        %              MIN starts from +inf (anything is lower)
        ( IsMax == true -> Init is -Inf ; Init = Inf ),
        loop(Ms, IsMax, S, D, A, B, P, TD, Ply, H, 0, Init, -1, V, BI, Kids0, none, Best),
        exclude(==(none), Kids0, Kids),      % drop children that are not drawn
        Status = explored
    ),
    flag(ab_nodes, N1, N1),
    Sub is N1 - N0,                          % how many nodes were searched below this one
    (   TD >= 0
    ->  % still inside the drawn part of the tree: build the node dict
        state_board(S, Bd), board_string(Bd, BS),
        state_phase(S, Phase),
        Node = _{ id:Id, board:BS, turn:T, phase:Phase, max:IsMax,
                  alpha:A, beta:B, score:V, status:Status,
                  best:BI, subtree:Sub, ply:Ply, children:Kids,
                  move:null, label:"start", captured:[] }
    ;   Node = none
    ).

/*  loop(Moves, IsMax, State, Depth, A, B, Player, ShowDepth, Ply, Seen,
         Index, BestV0, BestI0, BestV, BestI, Kids, BestM0, BestM)

    Goes through the moves one by one (recursion on the list).
    TRICK: accumulator pattern. BestV0/BestI0/BestM0 are "the best so far"
    going IN, BestV/BestI/BestM are the final answer coming OUT. The empty
    list clause (first clause) copies the "so far" values to the answer.

    For each move M:
      1. play it -> S1
      2. if S1 is a repeated position -> score it with a penalty (repetition_leaf)
         otherwise -> search it recursively with ab/11 (one depth less)
      3. if the score is better than the best so far, remember it
      4. update the window:  MAX raises Alpha,  MIN lowers Beta
      5. if A >= B -> CUT-OFF: stop, mark the remaining moves as pruned
         else       -> continue with the next move
*/
loop([], _, _, _, _, _, _, _, _, _, _, BV, BI, BV, BI, [], BM, BM).
loop([M|Ms], IsMax, S, D, A, B, P, TD, Ply, H, I, BV0, BI0, BV, BI, [K|Ks], BM0, BM) :-
    apply_move(S, M, S1, Caps),                                   % 1
    D1 is D - 1, TD1 is TD - 1, Ply1 is Ply + 1,
    state_key(S1, Key1),
    (   state_phase(S1, move), memberchk(Key1, H)                 % 2
    ->  repetition_leaf(S, S1, P, A, B, TD1, Ply1, V1, K0)
    ;   ab(S1, D1, A, B, P, TD1, Ply1, [Key1|H], V1, _, K0)
    ),
    attach_move(K0, M, Caps, K),
    (   improves(IsMax, V1, BV0)                                  % 3
    ->  BV1 = V1, BI1 = I, BM1 = M
    ;   BV1 = BV0, BI1 = BI0, BM1 = BM0
    ),
    (   IsMax == true                                             % 4
    ->  A1 is max(A, BV1), B1 = B
    ;   A1 = A, B1 is min(B, BV1)
    ),
    (   A1 >= B1, Ms \== []                                       % 5
    ->  % Alpha-beta cut-off: the remaining siblings are never searched.
        length(Ms, NP), flag(ab_pruned, X, X + NP),
        pruned_kids(Ms, S, TD1, Ply1, A1, B1, Ks),
        BV = BV1, BI = BI1, BM = BM1
    ;   I1 is I + 1,
        loop(Ms, IsMax, S, D, A1, B1, P, TD, Ply, H, I1, BV1, BI1, BV, BI, Ks, BM1, BM)
    ).

%   repetition_leaf(+Parent, +State, +Player, +A, +B, +ShowDepth, +Ply, -Value, -Node)
%   A position seen before: score it statically, minus the contempt penalty
%   for whichever side chose to repeat.
%   If the AI (P) repeats -> its score gets WORSE (-40), so it avoids it.
%   If the opponent repeats -> good for the AI (+40).
repetition_leaf(S0, S, P, A, B, TD, Ply, V, Node) :-
    flag(ab_nodes, N, N + 1),
    flag(ab_leaves, L, L + 1),
    flag(ab_id, Id, Id + 1),
    evaluate(S, P, 0, E),
    contempt(C),
    state_turn(S0, Mover),                   % who made the move into the repeated position
    ( Mover == P -> V is E - C ; V is E + C ),
    (   TD >= 0
    ->  state_board(S, Bd), board_string(Bd, BS),
        state_turn(S, T), state_phase(S, Phase),
        Node = _{ id:Id, board:BS, turn:T, phase:Phase, max:null,
                  alpha:A, beta:B, score:V, status:repeat,
                  best:(-1), subtree:1, ply:Ply, children:[],
                  move:null, label:"", captured:[] }
    ;   Node = none
    ).

%   improves(IsMax, NewValue, BestSoFar): is the new value better?
%   For MAX "better" means bigger, for MIN it means smaller.
improves(true, V, Best)  :- V > Best.
improves(false, V, Best) :- V < Best.

%   pruned_kids: build tree nodes for the moves that were cut off, only so
%   the website can show them in red. They are NOT searched (score null).
%   First clause: below the drawn depth -> nothing to draw.
pruned_kids(_, _, TD, _, _, _, []) :- TD < 0, !.
pruned_kids(Ms, S, _, Ply, A, B, Ks) :-
    findall(K,
            ( member(M, Ms),
              apply_move(S, M, S1, Caps),
              state_board(S1, Bd), board_string(Bd, BS),
              state_turn(S1, T), state_phase(S1, Phase),
              flag(ab_id, Id, Id + 1),
              K0 = _{ id:Id, board:BS, turn:T, phase:Phase, max:null,
                      alpha:A, beta:B, score:null, status:pruned,
                      best:(-1), subtree:0, ply:Ply, children:[],
                      move:null, label:"", captured:[] },
              attach_move(K0, M, Caps, K) ),
            Ks).

%   attach_move: write the move that led to a node into its dict
%   (as JSON, as a label like "c4-c3", and the captured squares).
%   K0.put(_{...}) returns a NEW dict with those keys added/replaced.
attach_move(none, _, _, none) :- !.
attach_move(K0, M, Caps, K) :-
    move_json(M, MJ),
    move_label(M, L),
    K = K0.put(_{move:MJ, label:L, captured:Caps}).

/*  mark_path(+Node0, -Node): flag the principal variation as best.
    The "principal variation" is the line of moves the AI expects:
    root -> its best child -> that child's best child -> ...
    Each node stores the index of its best child in "best". We follow it
    and set status = best (green on the website), recursively.
    nth0(BI, Cs0, _, Rest) removes element BI from the list, and
    nth0(BI, Cs, C2, Rest) puts the new one back at the same position.
*/
mark_path(N0, N) :-
    get_dict(best, N0, BI),
    get_dict(children, N0, Cs0),
    (   BI >= 0, nth0(BI, Cs0, C0)
    ->  put_dict(status, C0, best, C1),
        mark_path(C1, C2),
        nth0(BI, Cs0, _, Rest),
        nth0(BI, Cs, C2, Rest),
        put_dict(children, N0, Cs, N)
    ;   N = N0
    ).

/*  order_moves(+State, +Moves, -Ordered)
    Captures first (largest first) and safe squares first; better ordering
    means earlier cut-offs.
    Alpha-beta prunes the most when the BEST move is tried FIRST, so we
    sort moves by a quick guess (a key, smaller = tried earlier).

    TRICK: the "pairs" idiom for sorting by a computed key:
      map_list_to_pairs  [m1, m2]          -> [K1-m1, K2-m2]
      keysort            sorts by K (stable: equal keys keep their order)
      pairs_values       [K1-m1, K2-m2]    -> [m1, m2]
*/
order_moves(S, Ms, Ordered) :-
    map_list_to_pairs(move_key(S), Ms, Pairs),
    keysort(Pairs, Sorted),
    pairs_values(Sorted, Ordered).

%   move_key(+State, +Move, -Key): smaller key = tried first.
%   stop     -> 100 (last: continuing a capture chain is usually better)
%   drop     -> corner 0, next to centre 1, edge 2, other 3
%   move     -> -(10 * captures) - (1 if it goes to the centre)
%               e.g. a double capture gets -20 and comes before a single one (-10)
move_key(_, stop, 100) :- !.
move_key(_, drop(I), K) :- !,
    (   corner(I) -> K = 0
    ;   adj(I, _, C), centre(C) -> K = 1
    ;   edge(I) -> K = 2
    ;   K = 3
    ).
move_key(S, move(F, T), K) :-
    state_board(S, B), state_turn(S, P),
    move_captures(B, P, F, T, Caps),
    length(Caps, N),
    ( centre(T) -> C = 1 ; C = 0 ),
    K is -(10*N) - C.

                 /*******************************
                 *        MOVE <-> JSON         *
                 *******************************/

%   move_json(Move, Dict): how a move is sent to the website.
%     drop(7)     -> {"type":"drop","to":7}
%     move(7,12)  -> {"type":"move","from":7,"to":12}
move_json(drop(I), _{type:"drop", to:I}).
move_json(move(F, T), _{type:"move", from:F, to:T}).
move_json(stop, _{type:"stop"}).
move_json(none, null).

%   move_label(Move, Text): human-readable name, e.g. "drop b4" or "c4-c3".
move_label(drop(I), L) :- square_name(I, N), format(string(L), "drop ~w", [N]).
move_label(move(F, T), L) :-
    square_name(F, NF), square_name(T, NT),
    format(string(L), "~w-~w", [NF, NT]).
move_label(stop, "stop").
move_label(none, "-").
