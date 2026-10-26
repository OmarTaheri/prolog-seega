/*  board.pl -- The Seega board as a knowledge base.

    WHAT THIS FILE DOES
    -------------------
    It describes the 5x5 board: which squares exist, which squares touch
    each other, and small helpers to read and write a square.
    The other files (rules, eval, ai) only "ask questions" to this file,
    they never compute rows/columns themselves.

    HOW SQUARES ARE NUMBERED (row-major order, row 0 is the top)

            a    b    c    d    e        <- column letters (used in move labels)
          +----+----+----+----+----+
       5  |  0 |  1 |  2 |  3 |  4 |     Index = Row*5 + Col
          +----+----+----+----+----+
       4  |  5 |  6 |  7 |  8 |  9 |     example: Row 2, Col 2 -> 2*5+2 = 12
          +----+----+----+----+----+              (the centre square)
       3  | 10 | 11 | 12 | 13 | 14 |
          +----+----+----+----+----+
       2  | 15 | 16 | 17 | 18 | 19 |
          +----+----+----+----+----+
       1  | 20 | 21 | 22 | 23 | 24 |
          +----+----+----+----+----+

    HOW A BOARD IS STORED
    ---------------------
    A board is ONE compound term with 25 arguments:   b(e,e,w,b,e, ...)
      e = empty,  w = white stone,  b = black stone
    Why not a list?  With a list, reaching square 20 means walking past 20
    elements. With a compound term, arg/3 jumps straight to any argument
    (like an array in C/Java). The AI reads squares millions of times, so
    this makes the search much faster.

    Note: Prolog arguments are numbered from 1, our squares from 0, so we
    always add 1 when we call arg/3 (see cell/3).
*/

%   A module is like a "namespace": only the predicates in this list can be
%   used by other files. Everything else (like dir_delta/3) stays private.
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

%   Simple facts: the board is 5 wide and the centre square is number 12.
board_size(5).
centre(12).

%   other(Player, Opponent): white's opponent is black and the other way round.
%   Two facts are enough; Prolog finds the right one by pattern matching.
other(w, b).
other(b, w).

%   dir_delta(Direction, RowChange, ColChange)
%   Moving "up" means the row number goes down by 1, and so on.
%   Only 4 directions: Seega has NO diagonal moves or captures.
dir_delta(up,    -1,  0).
dir_delta(down,   1,  0).
dir_delta(left,   0, -1).
dir_delta(right,  0,  1).

/*  TRICK: term_expansion/2 (generating facts while the file loads)
    -----------------------------------------------------------------
    We need 25 coord/3 facts and 80 adj/3 facts. Writing them by hand
    would be long and easy to get wrong. Instead:

      1. Below there is a dummy fact  "generate_kb."
      2. When Prolog loads this file and reads that fact, it first calls
         term_expansion(generate_kb, Facts).
      3. Our clause computes the real facts and returns them as a list.
      4. Prolog loads THAT list instead of "generate_kb".

    The result is exactly as if we had typed, for example:
        coord(0, 0, 0).   coord(1, 0, 1).   ...   coord(24, 4, 4).
        adj(0, down, 5).  adj(0, right, 1). ...

    Facts are the fastest thing Prolog can look up (it even indexes them),
    so later questions like "adj(7, D, N)?" are answered instantly.

    TRICK: findall + between as a "for loop"
    ----------------------------------------
    between(0, 4, R) gives R = 0, then on backtracking 1, 2, 3, 4.
    Two betweens in a row = two nested for-loops.
    findall(Template, Goal, List) collects every solution of Goal into List.
*/
term_expansion(generate_kb, Facts) :-
    % coord(Index, Row, Col) for every square
    findall(coord(I, R, C),
            ( between(0, 4, R), between(0, 4, C), I is R*5 + C ),
            Coords),
    % adj(Index, Direction, Neighbour): step one square in direction D and
    % keep it only if we are still on the board (row and col in 0..4).
    findall(adj(I, D, J),
            ( between(0, 4, R), between(0, 4, C),
              dir_delta(D, DR, DC),
              R2 is R + DR, C2 is C + DC,
              between(0, 4, R2), between(0, 4, C2),   % "still on the board?" check
              I is R*5 + C, J is R2*5 + C2 ),
            Adjs),
    append(Coords, Adjs, Facts).

generate_kb.        % <- replaced by the facts above when the file loads

%   corner(I): squares 0, 4, 20, 24 (row is 0 or 4 AND column is 0 or 4).
%   memberchk/2 = "is X in this list?" and stops after the first match.
corner(I) :- coord(I, R, C), memberchk(R, [0,4]), memberchk(C, [0,4]).

%   edge(I): on the border but not a corner.
%   ( A ; B ) means "A or B".  \+ means "not" (negation as failure:
%   \+ corner(I) succeeds when Prolog CANNOT prove corner(I)).
edge(I)   :- coord(I, R, C), ( memberchk(R, [0,4]) ; memberchk(C, [0,4]) ), \+ corner(I).

%   empty_board(-B): build b(_,_,...,_) with 25 holes, then fill each with e.
%   functor(B, b, 25) creates a term named b with 25 fresh arguments.
%   forall(Cond, Action) = "for every I in 1..25 do the action".
empty_board(B) :-
    functor(B, b, 25),
    forall(between(1, 25, I), nb_setarg(I, B, e)).

%   cell(?Index, +Board, ?Value): what is on square Index?
%   It works in two directions (a classic Prolog idea):
%     cell(7, B, V)   -> "what is on square 7?"          (Index known)
%     cell(I, B, w)   -> "give me every square with w"    (Index unknown,
%                         arg/3 then tries every argument on backtracking)
%   integer(I) checks which case we are in.
cell(I, B, V) :-
    (   integer(I)
    ->  I1 is I + 1, arg(I1, B, V)          % squares start at 0, args at 1
    ;   arg(I1, B, V), I is I1 - 1
    ).

/*  set_cell(+Index, +Value, +Board0, -Board): put Value on square Index.

    TRICK: copy first, then change the copy.
    nb_setarg/3 CHANGES a term in place (it is destructive, like
    array[i] = v in Java). Changing Board0 directly would break the
    search, because the AI still needs the old board when it backtracks.
    So we first make a fresh copy with duplicate_term/2 and only change
    the copy. From the outside it behaves like a normal pure predicate:
    Board0 is never modified.
*/
set_cell(I, V, B0, B) :-
    duplicate_term(B0, B),
    I1 is I + 1,
    nb_setarg(I1, B, V).

%   piece_count(+Board, +Player, -N): how many stones of Player are on the board.
%   aggregate_all(count, Goal, N) counts how many times Goal succeeds.
%   Here cell(_, B, P) succeeds once for each square that holds P.
piece_count(B, P, N) :-
    aggregate_all(count, cell(_, B, P), N).

/*  board_string(?Board, ?String): board <-> "eewbe...e" (25 characters).
    Used to send the board to Python/React as JSON, and to compare
    positions (two boards are the same if their strings are equal).

    It works both ways:
      Board known  -> make the string
      String known -> rebuild the board

    TRICK: =.. ("univ") turns a term into a list and back:
         b(e,w,b) =.. [b, e, w, b]
    TRICK: [C,A]>>Goal is a small anonymous function (yall lambda).
         maplist applies it to every pair of elements:
         here it turns each character 'w' into the atom w.
*/
board_string(B, S) :-
    (   nonvar(B)
    ->  B =.. [b|Cells], atomic_list_concat(Cells, A), atom_string(A, S)
    ;   string_chars(S, Chars), length(Chars, 25),
        maplist([C,A]>>atom_chars(A, [C]), Chars, Cells),
        B =.. [b|Cells]
    ).

%   square_name(+Index, -Name): 0 -> a5, 12 -> c3, 24 -> e1 (like chess names).
%   0'a is the character code of the letter a (97). Adding the column
%   gives a, b, c, d or e. Rows are counted from the bottom, so row = 5 - R.
square_name(I, Name) :-
    coord(I, R, C),
    Code is 0'a + C, char_code(Col, Code),
    Row is 5 - R,
    format(atom(Name), '~w~w', [Col, Row]).
