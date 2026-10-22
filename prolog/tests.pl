/*  tests.pl -- run with:  swipl -g run_tests -t halt prolog/tests.pl  */
:- use_module(library(plunit)).
:- use_module(board).
:- use_module(rules).
:- use_module(ai).
:- use_module(api).

%   board_of(+Rows, -Board): 5 atoms/strings of 5 chars, '.' = empty.
board_of(Rows, B) :-
    atomic_list_concat(Rows, A),
    atom_chars(A, Cs),
    maplist([C,X]>>(C == '.' -> X = e ; X = C), Cs, Cells),
    B =.. [b|Cells].

move_state(Rows, Turn, s(B, move, Turn, 0, 0, 0, none, 0, none, false)) :-
    board_of(Rows, B).

:- begin_tests(seega).

test(adjacency_facts) :-
    aggregate_all(count, adj(_, _, _), N), N =:= 80,
    aggregate_all(count, adj(12, _, _), 4),
    aggregate_all(count, adj(0, _, _), 2).

test(drop_keeps_centre_empty) :-
    initial_state(S),
    legal_moves(S, Ms),
    length(Ms, 24),
    \+ memberchk(drop(12), Ms),
    \+ apply_move(S, drop(12), _, _).

test(two_drops_per_turn) :-
    initial_state(S0),
    apply_move(S0, drop(0), S1, _), state_turn(S1, w),
    apply_move(S1, drop(1), S2, _), state_turn(S2, b).

test(drop_phase_ends_with_black_to_move) :-
    initial_state(S0),
    numlist(0, 24, All), subtract(All, [12], Squares),
    foldl([I,A,B]>>apply_move(A, drop(I), B, _), Squares, S0, S),
    state_phase(S, P), memberchk(P, [move, over]).

test(simple_capture) :-
    % w at a4 (5), b at b4 (6), w moves d4 (8) -> c4 (7): b4 sandwiched.
    move_state(['.....',
                'wb.w.',
                '.....',
                '.....',
                '....b'], w, S),
    apply_move(S, move(8, 7), _, Caps),
    Caps == [6].

test(centre_immunity) :-
    % b stands on the centre (c3) between w b3 and the square d3 w moves into.
    move_state(['.....',
                '...w.',
                '.wb..',
                '.....',
                '....b'], w, S),
    apply_move(S, move(8, 13), _, Caps),
    Caps == [].
test(moving_between_two_enemies_is_safe) :-
    move_state(['.....',
                'b.b..',
                '.w...',
                '.....',
                '....w'], w, S),
    apply_move(S, move(11, 6), S1, Caps),
    Caps == [],
    state_board(S1, B), cell(6, B, w).

test(multi_capture) :-
    % w moves into c3? use c4 (7): captures b3(?) - set up two sandwiches.
    move_state(['..w..',
                'wb.bw',
                '..b..',
                '..w..',
                '.....'], w, S),
    apply_move(S, move(2, 7), _, Caps0),
    msort(Caps0, Caps),
    Caps == [6, 8].

test(blocked_player_gives_extra_turn) :-
    % Black has a single piece in the corner with no empty neighbours.
    move_state(['bw...',
                'w....',
                '.....',
                '.....',
                '....w'], w, S0),
    apply_move(S0, move(24, 23), S, _),
    state_turn(S, w),
    arg(10, S, true).

test(game_ends_when_side_eliminated) :-
    move_state(['.....',
                'wb.w.',
                '.....',
                '.....',
                '.....'], w, S),
    apply_move(S, move(8, 7), S1, [6]),
    game_over(S1), arg(9, S1, w).

test(ai_takes_free_capture) :-
    move_state(['.....',
                'wb.w.',
                '.....',
                '...b.',
                'b...b'], w, S),
    best_move(S, 2, 1, M, _, Tree, Stats),
    M == move(8, 7),
    get_dict(status, Tree, root),
    get_dict(nodes, Stats, N), N > 1.

test(threefold_repetition_ends_game) :-
    move_state(['b....',
                '.....',
                '..w..',
                '.....',
                '....w'], w, S0),
    apply_move(S0, move(24, 23), S1, _),
    state_key(S1, K),
    seega_api:play_move(S0, move(24, 23), [K, K], S, _),
    game_over(S), arg(9, S, w).

test(search_penalises_repetition) :-
    move_state(['b....',
                '.....',
                '..w..',
                '.....',
                '....w'], w, S0),
    apply_move(S0, move(24, 23), S1, _),
    state_key(S1, K),
    % With e1-d1 already seen twice, the engine should pick another move.
    best_move(S0, 1, 1, [K, K], M, _, _, _),
    M \== move(24, 23).

test(api_roundtrip) :-
    handle("{\"cmd\":\"new\"}", Out),
    sub_string(Out, _, _, _, "\"ok\":true").

:- end_tests(seega).
