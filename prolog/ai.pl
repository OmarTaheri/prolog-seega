/*  ai.pl -- Minimax search with alpha-beta pruning.

    The side to move at the root is the maximising player. Because a turn
    does not always alternate (two drops per turn, capture chains, extra
    turns for a blocked opponent), every node decides max/min by asking
    whose turn it is, rather than by depth parity.

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
            root_move_values/5,
            state_key/2,
            move_json/2,
            move_label/2,
            inf/1
          ]).
:- use_module(board).
:- use_module(rules).
:- use_module(eval).

inf(1000000).

%   Repeating an earlier position costs the side that makes the repetition,
%   so two engines cannot shuffle the same pieces back and forth forever.
contempt(40).

%   state_key(+State, -Key): identifies a position (board + side to move).
state_key(S, K) :-
    state_board(S, B), board_string(B, BS),
    state_turn(S, T),
    string_concat(BS, T, K).

%   best_move(+State, +Depth, +ShowDepth, -Move, -Value, -Tree, -Stats)
best_move(S, Depth, ShowDepth, Move, Value, Tree, Stats) :-
    best_move(S, Depth, ShowDepth, [], Move, Value, Tree, Stats).

%   best_move(+State, +Depth, +ShowDepth, +History, -Move, -Value, -Tree, -Stats)
%   History: keys of the positions already seen in this game.
best_move(S, Depth, ShowDepth, Hist, Move, Value, Tree, Stats) :-
    state_turn(S, P),
    inf(Inf), NInf is -Inf,
    flag(ab_nodes, _, 0), flag(ab_pruned, _, 0),
    flag(ab_leaves, _, 0), flag(ab_id, _, 0),
    statistics(cputime, T0),
    state_key(S, K0),
    ab(S, Depth, NInf, Inf, P, ShowDepth, 0, [K0|Hist], Value, Move, Root0),
    statistics(cputime, T1),
    Ms is round((T1 - T0) * 1000),
    flag(ab_nodes, N, N), flag(ab_pruned, Pr, Pr), flag(ab_leaves, L, L),
    put_dict(status, Root0, root, Root1),
    mark_path(Root1, Tree),
    Stats = _{nodes:N, pruned:Pr, leaves:L, time_ms:Ms, depth:Depth, show_depth:ShowDepth}.

%   ab(+State, +Depth, +Alpha, +Beta, +Player, +ShowDepth, +Ply, +Seen, -Value, -BestMove, -Node)
ab(S, D, A, B, P, TD, Ply, H, V, Best, Node) :-
    flag(ab_nodes, N0, N0 + 1),
    flag(ab_id, Id, Id + 1),
    state_turn(S, T),
    ( T == P -> IsMax = true ; IsMax = false ),
    (   ( D =< 0 ; game_over(S) ; legal_moves(S, []) )
    ->  evaluate(S, P, D, V),
        flag(ab_leaves, L, L + 1),
        Best = none, BI = -1, Kids = [], Status = leaf
    ;   legal_moves(S, Ms0),
        order_moves(S, Ms0, Ms),
        inf(Inf),
        ( IsMax == true -> Init is -Inf ; Init = Inf ),
        loop(Ms, IsMax, S, D, A, B, P, TD, Ply, H, 0, Init, -1, V, BI, Kids0, none, Best),
        exclude(==(none), Kids0, Kids),
        Status = explored
    ),
    flag(ab_nodes, N1, N1),
    Sub is N1 - N0,
    (   TD >= 0
    ->  state_board(S, Bd), board_string(Bd, BS),
        state_phase(S, Phase),
        Node = _{ id:Id, board:BS, turn:T, phase:Phase, max:IsMax,
                  alpha:A, beta:B, score:V, status:Status,
                  best:BI, subtree:Sub, ply:Ply, children:Kids,
                  move:null, label:"start", captured:[] }
    ;   Node = none
    ).

loop([], _, _, _, _, _, _, _, _, _, _, BV, BI, BV, BI, [], BM, BM).
loop([M|Ms], IsMax, S, D, A, B, P, TD, Ply, H, I, BV0, BI0, BV, BI, [K|Ks], BM0, BM) :-
    apply_move(S, M, S1, Caps),
    D1 is D - 1, TD1 is TD - 1, Ply1 is Ply + 1,
    state_key(S1, Key1),
    (   state_phase(S1, move), memberchk(Key1, H)
    ->  repetition_leaf(S, S1, P, A, B, TD1, Ply1, V1, K0)
    ;   ab(S1, D1, A, B, P, TD1, Ply1, [Key1|H], V1, _, K0)
    ),
    attach_move(K0, M, Caps, K),
    (   improves(IsMax, V1, BV0)
    ->  BV1 = V1, BI1 = I, BM1 = M
    ;   BV1 = BV0, BI1 = BI0, BM1 = BM0
    ),
    (   IsMax == true
    ->  A1 is max(A, BV1), B1 = B
    ;   A1 = A, B1 is min(B, BV1)
    ),
    (   A1 >= B1, Ms \== []
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
repetition_leaf(S0, S, P, A, B, TD, Ply, V, Node) :-
    flag(ab_nodes, N, N + 1),
    flag(ab_leaves, L, L + 1),
    flag(ab_id, Id, Id + 1),
    evaluate(S, P, 0, E),
    contempt(C),
    state_turn(S0, Mover),
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

improves(true, V, Best)  :- V > Best.
improves(false, V, Best) :- V < Best.

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

attach_move(none, _, _, none) :- !.
attach_move(K0, M, Caps, K) :-
    move_json(M, MJ),
    move_label(M, L),
    K = K0.put(_{move:MJ, label:L, captured:Caps}).

%   mark_path(+Node0, -Node): flag the principal variation as best.
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

%   order_moves(+State, +Moves, -Ordered)
%   Captures first (largest first) and safe squares first; better ordering
%   means earlier cut-offs.
order_moves(S, Ms, Ordered) :-
    map_list_to_pairs(move_key(S), Ms, Pairs),
    keysort(Pairs, Sorted),
    pairs_values(Sorted, Ordered).

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

%   root_move_values(+State, +Depth, +History, -Pairs, -Player)
%   Full-window value of every legal root move: used to grade a player's move.
root_move_values(S, Depth, Hist, Pairs, P) :-
    state_turn(S, P),
    legal_moves(S, Ms),
    inf(Inf), NInf is -Inf,
    D1 is Depth - 1,
    state_key(S, K0),
    H = [K0|Hist],
    findall(V-M,
            ( member(M, Ms),
              apply_move(S, M, S1, _),
              state_key(S1, K1),
              (   state_phase(S1, move), memberchk(K1, H)
              ->  repetition_leaf(S, S1, P, NInf, Inf, -1, 1, V, _)
              ;   ab(S1, D1, NInf, Inf, P, -1, 1, [K1|H], V, _, _)
              ) ),
            Pairs).

                 /*******************************
                 *        MOVE <-> JSON         *
                 *******************************/

move_json(drop(I), _{type:"drop", to:I}).
move_json(move(F, T), _{type:"move", from:F, to:T}).
move_json(stop, _{type:"stop"}).
move_json(none, null).

move_label(drop(I), L) :- square_name(I, N), format(string(L), "drop ~w", [N]).
move_label(move(F, T), L) :-
    square_name(F, NF), square_name(T, NT),
    format(string(L), "~w-~w", [NF, NT]).
move_label(stop, "stop").
move_label(none, "-").
