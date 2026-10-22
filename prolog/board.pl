/*  board.pl -- The Seega board as a knowledge base.

    The 5x5 grid is indexed 0..24 in row-major order (row 0 is the top).
    Coordinates and orthogonal adjacency are stored as plain facts that
    are generated at compile time by term_expansion/2, so the rest of the
    program reasons over coord/3 and adj/3 like any hand-written facts.

    A board is the compound term b/25 whose arguments are the atoms
    e (empty), w (white) and b (black).
*/
:- module(board,
          [ board_size/1,
            centre/1,
            coord/3,
            adj/3,
            other/2,
            empty_board/1,
            cell/3,
            set_cell/4,
            piece_count/3,
            board_string/2,
            square_name/2,
            corner/1,
            edge/1
          ]).

board_size(5).
centre(12).

other(w, b).
other(b, w).

dir_delta(up,    -1,  0).
dir_delta(down,   1,  0).
dir_delta(left,   0, -1).
dir_delta(right,  0,  1).

%   generate_kb expands into coord(Index, Row, Col) and
%   adj(Index, Direction, NeighbourIndex) facts for the whole grid.
term_expansion(generate_kb, Facts) :-
    findall(coord(I, R, C),
            ( between(0, 4, R), between(0, 4, C), I is R*5 + C ),
            Coords),
    findall(adj(I, D, J),
            ( between(0, 4, R), between(0, 4, C),
              dir_delta(D, DR, DC),
              R2 is R + DR, C2 is C + DC,
              between(0, 4, R2), between(0, 4, C2),
              I is R*5 + C, J is R2*5 + C2 ),
            Adjs),
    append(Coords, Adjs, Facts).

generate_kb.

corner(I) :- coord(I, R, C), memberchk(R, [0,4]), memberchk(C, [0,4]).
edge(I)   :- coord(I, R, C), ( memberchk(R, [0,4]) ; memberchk(C, [0,4]) ), \+ corner(I).

empty_board(B) :-
    functor(B, b, 25),
    forall(between(1, 25, I), nb_setarg(I, B, e)).

%   cell(?Index, +Board, ?Value)
cell(I, B, V) :-
    (   integer(I)
    ->  I1 is I + 1, arg(I1, B, V)
    ;   arg(I1, B, V), I is I1 - 1
    ).

%   set_cell(+Index, +Value, +Board0, -Board)  (non-destructive)
set_cell(I, V, B0, B) :-
    duplicate_term(B0, B),
    I1 is I + 1,
    nb_setarg(I1, B, V).

piece_count(B, P, N) :-
    aggregate_all(count, cell(_, B, P), N).

%   board_string(?Board, ?String): 25 characters of e/w/b.
board_string(B, S) :-
    (   nonvar(B)
    ->  B =.. [b|Cells], atomic_list_concat(Cells, A), atom_string(A, S)
    ;   string_chars(S, Chars), length(Chars, 25),
        maplist([C,A]>>atom_chars(A, [C]), Chars, Cells),
        B =.. [b|Cells]
    ).

%   square_name(+Index, -Name): columns a..e, rows 5 (top) .. 1 (bottom).
square_name(I, Name) :-
    coord(I, R, C),
    Code is 0'a + C, char_code(Col, Code),
    Row is 5 - R,
    format(atom(Name), '~w~w', [Col, Row]).
