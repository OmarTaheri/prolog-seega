/* Slide data for the Seega Prolog presentation (served at /presentation).
   Code snippets come from prolog/*.pl and backend/*.py.
   Diagrams are drawn with the small helpers below (black and white only). */
(function () {
  'use strict';
  const R = String.raw;
  let uid = 0;

  /* ================= diagram helpers ================= */

  const grey = (t) => { const v = Math.round(255 * t); return `rgb(${v},${v},${v})`; };
  const DIRS = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };

  /* grid({ board, size, nums, coords, text, shade, ring, cross, arrows, pad })
     board: 25 chars of . w b   (row 0 = top)                                 */
  function grid(o = {}) {
    const s = o.size || 64;
    const pad = o.pad != null ? o.pad : (o.coords ? 34 : 4);
    const board = (o.board || '.'.repeat(25)).replace(/\s/g, '');
    const W = s * 5 + pad * 2;
    const id = 'ah' + (++uid);
    const X = (i) => pad + (i % 5) * s;
    const Y = (i) => pad + Math.floor(i / 5) * s;
    const cx = (i) => X(i) + s / 2;
    const cy = (i) => Y(i) + s / 2;
    let g = `<svg class="grid" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">` +
      `<defs><marker id="${id}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">` +
      `<path d="M0,0 L10,5 L0,10 z" fill="#fff"/></marker></defs>`;
    for (let i = 0; i < 25; i++) {
      const sh = o.shade && o.shade[i] != null ? o.shade[i] : null;
      g += `<rect x="${X(i)}" y="${Y(i)}" width="${s}" height="${s}" fill="${sh != null ? grey(sh) : '#000'}" stroke="#fff" stroke-width="2"/>`;
      if (i === 12 && o.centre !== false) {
        const m = s * 0.14;
        g += `<rect x="${X(i) + m}" y="${Y(i) + m}" width="${s - 2 * m}" height="${s - 2 * m}" fill="none" stroke="${sh != null && sh > .55 ? '#000' : '#666'}" stroke-width="2" stroke-dasharray="4 4"/>`;
      }
      if (o.nums) {
        g += `<text x="${X(i) + 5}" y="${Y(i) + s * 0.25}" font-size="${Math.max(11, s * 0.2)}" fill="${sh != null && sh > .55 ? '#000' : '#8a8a8a'}">${i}</text>`;
      }
    }
    if (o.coords) {
      for (let c = 0; c < 5; c++) g += `<text x="${pad + c * s + s / 2}" y="${pad - 10}" font-size="20" fill="#9a9a9a" text-anchor="middle">${'abcde'[c]}</text>`;
      for (let r = 0; r < 5; r++) g += `<text x="${pad - 12}" y="${pad + r * s + s / 2 + 7}" font-size="20" fill="#9a9a9a" text-anchor="middle">${5 - r}</text>`;
    }
    for (let i = 0; i < 25; i++) {
      const c = board[i];
      if (c === 'w') g += `<circle cx="${cx(i)}" cy="${cy(i)}" r="${s * 0.34}" fill="#fff"/>`;
      if (c === 'b') g += `<circle cx="${cx(i)}" cy="${cy(i)}" r="${s * 0.32}" fill="#000" stroke="#fff" stroke-width="${Math.max(2.5, s * 0.055)}"/>`;
    }
    (o.ring || []).forEach((i) => {
      g += `<circle cx="${cx(i)}" cy="${cy(i)}" r="${s * 0.45}" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="7 5"/>`;
    });
    (o.cross || []).forEach((i) => {
      const d = s * 0.24, col = board[i] === 'w' ? '#000' : '#fff';
      g += `<path d="M${cx(i) - d},${cy(i) - d} L${cx(i) + d},${cy(i) + d} M${cx(i) + d},${cy(i) - d} L${cx(i) - d},${cy(i) + d}" stroke="${col}" stroke-width="${s * 0.08}" stroke-linecap="round"/>`;
    });
    Object.entries(o.text || {}).forEach(([k, t]) => {
      const i = +k;
      const sh = o.shade && o.shade[i] != null ? o.shade[i] : 0;
      const col = board[i] === 'w' || sh > .55 ? '#000' : '#fff';
      g += `<text x="${cx(i)}" y="${cy(i) + s * 0.12}" font-size="${o.textSize || s * 0.36}" font-weight="700" fill="${col}" text-anchor="middle">${t}</text>`;
    });
    (o.arrows || []).forEach(([a, b, kind]) => {
      let tx, ty;
      if (typeof b === 'string') { const [dr, dc] = DIRS[b]; tx = cx(a) + dc * s; ty = cy(a) + dr * s; }
      else { tx = cx(b); ty = cy(b); }
      const x1 = cx(a), y1 = cy(a);
      const L = Math.hypot(tx - x1, ty - y1), ux = (tx - x1) / L, uy = (ty - y1) / L;
      const sx = x1 + ux * s * 0.38, sy = y1 + uy * s * 0.38;
      const ex = tx - ux * s * 0.36, ey = ty - uy * s * 0.36;
      if (kind === 'no') {
        g += `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="#777" stroke-width="3" stroke-dasharray="5 5"/>` +
          `<text x="${tx}" y="${ty + 9}" font-size="${s * 0.42}" font-weight="700" fill="#aaa" text-anchor="middle">✕</text>`;
      } else {
        g += `<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="#fff" stroke-width="${kind === 'thin' ? 3 : 5}" marker-end="url(#${id})"/>`;
      }
    });
    return g + '</svg>';
  }

  const B = (...rows) => rows.join('');
  const fig = (svg, cap) => `<figure>${svg}${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;
  const row = (...xs) => `<div class="drow">${xs.join('')}</div>`;
  const col = (...xs) => `<div class="dcol">${xs.join('')}</div>`;
  const colT = (...xs) => `<div class="dcol tight">${xs.join('')}</div>`;
  const arrow = (label, cls) => `<div class="darrow ${cls || ''}">${label ? `<span>${label}</span>` : ''}${cls === 'down' ? '↓' : '→'}</div>`;
  const box = (t, s, cls) => `<div class="box ${cls || ''}"><b>${t}</b>${s ? `<small>${s}</small>` : ''}</div>`;
  const table = (head, rows, cls) => `<table class="t ${cls || ''}"><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>` +
    rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('') + '</table>';
  const chips = (list, lab) => `<div class="chips">${list.map((c) => c === '…' ? '<span class="sep">…</span>' :
    `<span class="chip ${c[0]}">${c.slice(1)}</span>`).join('')}${lab ? `<span class="lab">${lab}</span>` : ''}</div>`;

  /* tree(spec): spec = { v, k: 'max'|'min'|'leaf', s: 'best'|'pruned', c: [...], ann, lab } */
  function tree(root, o = {}) {
    const gx = o.gx || 100, gy = o.gy || 140, r = o.r || 30, left = o.levels ? 150 : 40;
    let leaves = 0, depthMax = 0;
    const nodes = [], edges = [];
    (function lay(n, d) {
      depthMax = Math.max(depthMax, d);
      n.y = 46 + d * gy;
      if (n.c && n.c.length) {
        n.c.forEach((ch) => { lay(ch, d + 1); edges.push([n, ch]); });
        n.x = (n.c[0].x + n.c[n.c.length - 1].x) / 2;
      } else n.x = left + r + leaves++ * gx;
      nodes.push(n);
    })(root, 0);
    const W = left + r * 2 + (leaves - 1) * gx + (o.extraW || 40);
    const H = 46 + depthMax * gy + r + 30;
    let g = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
    if (o.levels) o.levels.forEach((t, d) => {
      g += `<text x="10" y="${46 + d * gy + 8}" font-size="22" font-weight="700" fill="#8a8a8a">${t}</text>`;
    });
    edges.forEach(([p, c]) => {
      const st = c.s === 'best' ? 'stroke="#fff" stroke-width="6"' :
        c.s === 'pruned' ? 'stroke="#666" stroke-width="2.5" stroke-dasharray="7 6"' : 'stroke="#8a8a8a" stroke-width="2.5"';
      g += `<line x1="${p.x}" y1="${p.y}" x2="${c.x}" y2="${c.y}" ${st}/>`;
    });
    nodes.forEach((n) => {
      const best = n.s === 'best', pr = n.s === 'pruned';
      const fill = best ? '#fff' : '#000';
      const stroke = pr ? 'stroke="#666" stroke-dasharray="6 5" stroke-width="2.5"' : 'stroke="#fff" stroke-width="3"';
      const k = n.k || (n.c && n.c.length ? 'max' : 'leaf');
      if (k === 'max') g += `<rect x="${n.x - r}" y="${n.y - r}" width="${2 * r}" height="${2 * r}" fill="${fill}" ${stroke}/>`;
      else if (k === 'min') g += `<circle cx="${n.x}" cy="${n.y}" r="${r}" fill="${fill}" ${stroke}/>`;
      else g += `<rect x="${n.x - r * 0.85}" y="${n.y - r * 0.7}" width="${r * 1.7}" height="${r * 1.4}" rx="8" fill="${fill}" ${stroke}/>`;
      const txt = pr ? '✂' : (n.v != null ? n.v : '');
      g += `<text x="${n.x}" y="${n.y + 8}" font-size="${pr ? 22 : 24}" font-weight="800" fill="${best ? '#000' : pr ? '#777' : '#fff'}" text-anchor="middle">${txt}</text>`;
      if (n.lab) g += `<text x="${n.x}" y="${n.y - r - 10}" font-size="20" fill="#9a9a9a" text-anchor="middle">${n.lab}</text>`;
      if (n.ann) {
        const lines = n.ann.split('\n');
        lines.forEach((t, j) => {
          g += `<text x="${n.x + r + 12}" y="${n.y + 6 + j * 28 - (lines.length - 1) * 14}" font-size="24" fill="#e0e0e0" font-style="italic">${t}</text>`;
        });
      }
    });
    return g + '</svg>';
  }

  /* expand one predicate into "1. … 2. … 3. …" step slides */
  function steps(base, list) {
    const all = list.map((s) => s.t);
    return list.map((s, i) => Object.assign({}, base, s, { stepAll: all, stepIndex: i }));
  }
  /* cases(): one big numbered line per case (1 → …, 2 → …) */
  function cases(title, rows, note) {
    const big = rows.length <= 4;
    return {
      type: 'diagram', title,
      diagram: `<div class="flow" style="gap:${big ? 18 : 12}px">` + rows.map(([q, a], k) =>
        `<div class="frow"><span class="n" style="font-size:${big ? 40 : 34}px;width:60px">${k + 1}</span>` +
        `<div class="q" style="width:470px;font-size:${big ? 32 : 28}px;padding:${big ? 16 : 12}px 24px">${q}</div>` +
        `<span class="y" style="font-size:36px;color:#fff">→</span>` +
        `<div class="a" style="font-size:${big ? 30 : 27}px;padding:${big ? 16 : 12}px 24px;max-width:700px">${a}</div></div>`).join('') + `</div>`,
      note,
    };
  }
  function sec(name, list) { return list.flat().map((s) => Object.assign({ section: name }, s)); }

  /* fan(): how fast the game tree grows in the drop phase (24 · 23 · 22 · ...) */
  function fan() {
    const ax = 380, top = 24, base = 520, half = 300;
    const w = (y) => half * (y - top) / (base - top);
    const levels = [[1, '24'], [2, '552'], [3, '12 144'], [6, '96 909 120'], [12, '1.3 × 10¹⁵'], [24, '6.2 × 10²³']];
    const ys = [74, 128, 182, 290, 398, 512];
    const cut = 182;
    let g = `<svg width="1340" height="560" viewBox="0 0 1340 560">`;
    g += `<polygon points="${ax},${top} ${ax - w(cut)},${cut} ${ax + w(cut)},${cut}" fill="#fff"/>`;
    g += `<polygon points="${ax - w(cut)},${cut} ${ax + w(cut)},${cut} ${ax + w(base)},${base} ${ax - w(base)},${base}" fill="#111" stroke="#777" stroke-width="2" stroke-dasharray="8 6"/>`;
    ys.forEach((y, i) => {
      const [d, n] = levels[i];
      if (y !== cut) g += `<line x1="${ax - w(y)}" y1="${y}" x2="${ax + w(y)}" y2="${y}" stroke="${y < cut ? '#000' : '#555'}" stroke-width="2"/>`;
      g += `<line x1="${ax + w(y) + 10}" y1="${y}" x2="760" y2="${y}" stroke="#333" stroke-width="1.5" stroke-dasharray="3 5"/>`;
      g += `<text x="780" y="${y + 8}" font-size="24" fill="${y === cut ? "#fff" : "#8a8a8a"}">depth ${d}</text>`;
      g += `<text x="1150" y="${y + 9}" font-size="28" font-weight="800" fill="${y <= cut ? '#fff' : '#bbb'}" text-anchor="end">${n}</text>`;
    });
    g += `<line x1="40" y1="${cut}" x2="765" y2="${cut}" stroke="#fff" stroke-width="5"/>`;
    g += `<text x="1175" y="${cut - 6}" font-size="22" font-weight="800" fill="#fff">← our search</text>`;
    g += `<text x="1200" y="${cut + 22}" font-size="22" font-weight="800" fill="#fff">stops here</text>`;
    g += `<text x="40" y="${cut - 14}" font-size="20" fill="#fff">evaluate/4 guesses ↓</text>`;
    g += `<text x="${ax}" y="${base + 34}" font-size="22" fill="#9a9a9a" text-anchor="middle">board full: every possible drop order</text>`;
    return g + '</svg>';
  }

  /* ================= reusable boards ================= */

  const NUM_NAMES = {};
  for (let i = 0; i < 25; i++) NUM_NAMES[i] = 'abcde'[i % 5] + (5 - Math.floor(i / 5));

  const CAP_BOARD = B('..w..', '.bwbw', '..b..', '..w..', '.....');   // white just landed on 7
  const THREAT_BOARD = B('.....', '.w.bw', '.....', '.b...', '.w...');
  const EVAL_BOARD = B('w...w', '...b.', '..ww.', '....b', '.....');
  const VAL_MOVE = {}, SH_MOVE = {}, VAL_DROP = {}, SH_DROP = {};
  for (let i = 0; i < 25; i++) {
    const r = Math.floor(i / 5), c = i % 5;
    const corner = (r === 0 || r === 4) && (c === 0 || c === 4);
    const edge = !corner && (r === 0 || r === 4 || c === 0 || c === 4);
    const nextC = [7, 11, 13, 17].includes(i);
    const vm = corner ? 12 : i === 12 ? 15 : edge ? 4 : 0;
    const vd = corner ? 12 : edge ? 4 : nextC ? 2 : 0;
    VAL_MOVE[i] = vm; SH_MOVE[i] = vm / 15 * 0.9;
    VAL_DROP[i] = i === 12 ? '–' : vd; SH_DROP[i] = i === 12 ? 0 : vd / 15 * 0.9;
  }

  /* ================= slides ================= */

  const S = [];

  S.push(...sec('', [
    { type: 'title', title: 'Seega in Prolog', sub: 'The structure of the code, then every Prolog file one by one' },
  ]));

  /* ---------- 1. structure ---------- */
  S.push(...sec('structure', [
    { type: 'section', num: '01', title: 'The structure', sub: 'How the Prolog code is organised' },
    {
      type: 'diagram', title: 'Three layers',
      diagram: row(
        box('Browser', 'React<br>draws the board<br>knows NO rules'),
        arrow('HTTP + JSON'),
        box('Python', 'FastAPI<br>passes messages'),
        arrow('JSON text'),
        box('Prolog', 'all the rules<br>and the AI', 'inv')),
      note: 'Everything about the game lives in Prolog. The other two layers only show it and carry messages.',
    },
    {
      type: 'split', title: 'Five modules, stacked', lang: 'prolog', size: 24, ratio: 1.3,
      code: R`
% rules.pl
:- use_module(board).

% eval.pl
:- use_module(board).
:- use_module(rules).

% ai.pl
:- use_module(board).
:- use_module(rules).
:- use_module(eval).

% api.pl
:- use_module(board).   % + rules, eval, ai`,
      diagram: colT(
        box('api.pl', 'JSON door', 'sm'), arrow('', 'down'),
        box('ai.pl', 'the search', 'sm'), arrow('', 'down'),
        box('eval.pl', 'the score', 'sm'), arrow('', 'down'),
        box('rules.pl', 'the rules', 'sm'), arrow('', 'down'),
        box('board.pl', 'the board', 'sm inv')),
      note: 'Each file is a module and only uses the files <b>below</b> it.',
    },
  ]));

  /* ---------- 2. board.pl ---------- */
  const TERM_EXP = R`
term_expansion(generate_kb, Facts) :-
    % coord(Index, Row, Col) for every square
    findall(coord(I, R, C),
            ( between(0, 4, R), between(0, 4, C), I is R*5 + C ),
            Coords),
    % adj(Index, Direction, Neighbour)
    findall(adj(I, D, J),
            ( between(0, 4, R), between(0, 4, C),
              dir_delta(D, DR, DC),
              R2 is R + DR, C2 is C + DC,
              between(0, 4, R2), between(0, 4, C2),
              I is R*5 + C, J is R2*5 + C2 ),
            Adjs),
    append(Coords, Adjs, Facts).

generate_kb.        % <- replaced by the facts above`;

  S.push(...sec('board.pl', [
    { type: 'section', num: '02', title: '<code>board.pl</code>', sub: 'The board as a knowledge base: which squares exist and which squares touch' },
    {
      type: 'split', title: 'The board: one term, 25 squares', lang: 'prolog', size: 24,
      code: R`
% Index = Row*5 + Col      (row 0 is the top)
% e = empty,  w = white,  b = black

b(e,e,w,b,e,
  e,e,e,e,e,
  e,e,e,e,e,
  e,e,e,e,e,
  e,e,e,e,e)`,
      ex: R`
?- arg(3, b(e,e,w,b,e, ...), V).
V = w.          % square 2 (args start at 1)`,
      diagram: fig(grid({ size: 86, nums: true, coords: true, board: B('..wb.', '.....', '.....', '.....', '.....') }),
        'centre = square <b>12</b> = row 2, col 2'),
      note: 'A term, not a list: <code>arg/3</code> jumps straight to any square, like an array.',
    },
    {
      type: 'split', title: 'Simple facts', lang: 'prolog', size: 26,
      code: R`
board_size(5).
centre(12).

other(w, b).
other(b, w).

dir_delta(up,    -1,  0).
dir_delta(down,   1,  0).
dir_delta(left,   0, -1).
dir_delta(right,  0,  1).`,
      diagram: fig(grid({ size: 84, nums: true, board: B('.....', '..w..', '.....', '.....', '.....'),
        arrows: [[7, 2], [7, 12], [7, 6], [7, 8]] }),
        'from square 7 (row 1, col 2):<br><b>up</b> = row − 1 → square 2'),
      note: 'Only 4 directions: Seega has no diagonal moves.',
    },
    {
      type: 'split', title: 'The problem: 25 <code>coord</code> facts', lang: 'prolog', size: 26,
      code: R`
% coord(Square, Row, Col)
coord(0, 0, 0).
coord(1, 0, 1).
coord(2, 0, 2).
coord(3, 0, 3).
coord(4, 0, 4).
coord(5, 1, 0).
...
coord(12, 2, 2).
...
coord(24, 4, 4).`,
      diagram: fig(grid({ size: 86, nums: true, text: Object.fromEntries([...Array(25).keys()].map((i) => [i, Math.floor(i / 5) + ',' + (i % 5)])), textSize: 22 }), 'every square needs its row and column'),
    },
    {
      type: 'split', title: '… and 80 <code>adj</code> facts', lang: 'prolog', size: 24,
      code: R`
% adj(Square, Direction, Neighbour)
adj(0, down, 5).
adj(0, right, 1).
adj(1, down, 6).
adj(1, left, 0).
adj(1, right, 2).
...
adj(12, up, 7).
adj(12, down, 17).
adj(12, left, 11).
adj(12, right, 13).
...
adj(24, left, 23).`,
      diagram: fig(grid({ size: 84, nums: true, arrows: [[0, 5, 'thin'], [0, 1, 'thin'], [12, 7], [12, 17], [12, 11], [12, 13]] }),
        'corner 0 has 2 neighbours, centre 12 has 4'),
      note: '25 + 80 = <b>105 facts</b> to type by hand: long, and one typo breaks the game.',
    },
    {
      type: 'diagram', title: 'The solution: let Prolog write them',
      diagram: row(
        box('<code>generate_kb.</code>', 'one line in board.pl'),
        arrow('Prolog reads it'),
        box('<code>term_expansion</code>', 'built-in hook,<br>our rule matches'),
        arrow('replaced by'),
        box('105 facts', '25 × <code>coord/3</code><br>80 × <code>adj/3</code>', 'inv')),
      note: 'The knowledge base is <b>generated while the file loads</b>, exactly as if we had typed it.',
    },
    {
      type: 'code', title: '<code>term_expansion</code>', lang: 'prolog', code: TERM_EXP, size: 24,
      note: 'Prolog reads <code>generate_kb.</code> → asks <code>term_expansion</code> → loads the 25 <code>coord</code> + 80 <code>adj</code> facts instead. ' +
        '<code>between(0, 4, R2)</code> fails for −1 or 5, so steps off the board are skipped.',
    },
    {
      type: 'stack', title: '<code>corner</code> and <code>edge</code>', lang: 'prolog', size: 24,
      code: R`
corner(I) :- coord(I, R, C), memberchk(R, [0,4]), memberchk(C, [0,4]).

edge(I)   :- coord(I, R, C), ( memberchk(R, [0,4]) ; memberchk(C, [0,4]) ), \+ corner(I).`,
      diagram: row(
        fig(grid({ size: 62, text: { 0: 'C', 4: 'C', 20: 'C', 24: 'C', 1: 'E', 2: 'E', 3: 'E', 5: 'E', 9: 'E', 10: 'E', 14: 'E', 15: 'E', 19: 'E', 21: 'E', 22: 'E', 23: 'E' },
          shade: { 0: .9, 4: .9, 20: .9, 24: .9, 1: .35, 2: .35, 3: .35, 5: .35, 9: .35, 10: .35, 14: .35, 15: .35, 19: .35, 21: .35, 22: .35, 23: .35 } })),
        `<div style="font-size:28px;line-height:1.7"><code>[0,4]</code> = first or last <b>row / column</b><br>` +
        `corner: row on border <b>AND</b> column on border<br>edge: row <b>OR</b> column on border, <b>NOT</b> a corner<br>` +
        `<span style="color:#9a9a9a"><code>,</code> = and &nbsp; <code>;</code> = or &nbsp; <code>\\+</code> = not</span></div>`),
    },
    {
      type: 'split', title: '<code>empty_board</code>: making a board', lang: 'prolog', size: 24, ratio: 1.45,
      code: R`
empty_board(B) :-
    functor(B, b, 25),
    forall(between(1, 25, I), nb_setarg(I, B, e)).`,
      ex: R`
?- functor(B, b, 3).
B = b(_, _, _).

?- empty_board(B).
B = b(e,e,e,e,e, e,e,e,e,e, ...).`,
      exSize: 22,
      diagram: fig(grid({ size: 84, nums: true, text: Object.fromEntries([...Array(25).keys()].map((i) => [i, i + 1])), textSize: 26 }),
        'small = <b>square</b> 0 … 24 · big = <b>argument</b> 1 … 25'),
      note: 'Squares start at 0, arguments start at 1, so square <b>I</b> is argument <b>I + 1</b>.',
    },
    ...steps({
      type: 'split', title: 'Get and set a square', lang: 'prolog', size: 24,
      code: R`
cell(I, B, V) :-
    (   integer(I)
    ->  I1 is I + 1, arg(I1, B, V)
    ;   arg(I1, B, V), I is I1 - 1
    ).

set_cell(I, V, B0, B) :-
    duplicate_term(B0, B),
    I1 is I + 1,
    nb_setarg(I1, B, V).`,
    }, [
      {
        t: '1. get: cell', show: '1-5', ex: R`
?- cell(2, B, V).      % square known
V = b.                 % arg 3

?- cell(I, B, w).      % square unknown
I = 0 ;
I = 3.`,
        diagram: fig(grid({ size: 80, nums: true, board: B('w.bw.', '.....', '.....', '.....', '.....'), ring: [2] }), 'square 2 = argument 3'),
      },
      {
        t: '2. set: set_cell', show: '7-10', ex: R`
?- set_cell(12, w, B0, B).
% copy B0, then write arg 13`,
        diagram: row(
          fig(grid({ size: 44, nums: true }), '<b>B0</b> unchanged'),
          arrow(''),
          fig(grid({ size: 44, nums: true, board: B('.....', '.....', '..w..', '.....', '.....'), ring: [12] }), '<b>B</b> = the copy')),
        note: 'Copy first: the AI needs the old board again when it backtracks.',
      },
    ]),
    {
      type: 'split', title: '<code>piece_count</code>', lang: 'prolog', size: 26,
      code: R`
piece_count(B, P, N) :-
    aggregate_all(count, cell(_, B, P), N).`,
      ex: R`
?- piece_count(B, w, N).
N = 3.`,
      diagram: fig(grid({ size: 80, board: B('w.b..', '.....', '..w..', '...b.', 'w....'), text: { 0: '1', 12: '2', 20: '3' } }),
        '<code>cell(_, B, w)</code> succeeds 3 times'),
    },
    {
      type: 'code', title: '<code>board_string</code>: board ⇄ text', lang: 'prolog', size: 24,
      code: R`
board_string(B, S) :-
    (   nonvar(B)
    ->  B =.. [b|Cells], atomic_list_concat(Cells, A), atom_string(A, S)
    ;   string_chars(S, Chars), length(Chars, 25),
        maplist([C,A]>>atom_chars(A, [C]), Chars, Cells),
        B =.. [b|Cells]
    ).`,
      note: '<code>b(e,w,b) =.. [b,e,w,b]</code> → <code>"ewb"</code>, and back. Used to send the board to the website as text.',
    },
    {
      type: 'split', title: '<code>square_name</code>', lang: 'prolog', size: 24,
      code: R`
square_name(I, Name) :-
    coord(I, R, C),
    Code is 0'a + C, char_code(Col, Code),
    Row is 5 - R,
    format(atom(Name), '~w~w', [Col, Row]).`,
      ex: R`
coord(12, 2, 2)
97 + 2 = 99   ->  c
5 - 2  = 3
Name = c3`,
      diagram: fig(grid({ size: 84, text: NUM_NAMES, textSize: 24, ring: [12] }), 'square 12 → <b>c3</b>'),
    },
  ]));

  /* ---------- 3. rules.pl ---------- */
  const LEGAL = R`
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
    append(Caps, [stop], Moves).`;

  const CAPS = R`
captures_for(B, T, To, Caps) :-
    other(T, O),                  % O = the enemy
    findall(N,
            ( adj(To, D, N),      % N  = next square in direction D
              cell(N, B, O),      % 1. is N an enemy stone?
              \+ centre(N),       % 2. ...not on the centre?
              adj(N, D, N2),      % N2 = the square after it, SAME D
              cell(N2, B, T) ),   % 3. is N2 my stone?
            Caps).`;

  const capGrid = (o) => fig(grid(Object.assign({ size: 82, nums: true, board: CAP_BOARD, ring: [7] }, o)), o.cap || '');

  S.push(...sec('rules.pl', [
    { type: 'section', num: '03', title: '<code>rules.pl</code>', sub: 'What is allowed, and what happens after a move' },
    {
      type: 'stack', title: 'The game state: one term, 10 slots', lang: 'prolog', size: 30,
      code: R`s(Board, Phase, Turn, HandW, HandB, DropsLeft, Chain, NoCapture, Winner, Extra)`,
      diagram: table(['#', 'slot', 'meaning'], [
        ['1', '<code>Board</code>', 'the <code>b/25</code> term'],
        ['2', '<code>Phase</code>', '<code>drop</code> · <code>move</code> · <code>over</code>'],
        ['3', '<code>Turn</code>', '<code>w</code> or <code>b</code>'],
        ['4 5', '<code>HandW</code> <code>HandB</code>', 'stones still to place'],
        ['6', '<code>DropsLeft</code>', 'drops left this turn: 2 → 1 → 0'],
        ['7', '<code>Chain</code>', '<code>none</code>, or the square of the stone in a capture chain'],
        ['8', '<code>NoCapture</code>', 'moves in a row without a capture (50 = end)'],
        ['9', '<code>Winner</code>', '<code>none</code> · <code>w</code> · <code>b</code> · <code>draw</code>'],
        ['10', '<code>Extra</code>', '<code>true</code> = extra turn, the opponent was blocked'],
      ], 'big'),
    },
    {
      type: 'code', title: 'The start of the game', lang: 'prolog', size: 24, codeFlex: 2,
      code: R`
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
game_over(S)       :- state_phase(S, over).`,
      ex: R`
?- initial_state(S),
   state_turn(S, T).
T = w.

% getters read one slot
% with arg/3`,
    },
    {
      type: 'code', title: '<code>hand</code> and <code>dec_hand</code>', lang: 'prolog', size: 27,
      code: R`
hand(w, HW, _, HW).
hand(b, _, HB, HB).

dec_hand(w, HW0, HB, HW, HB) :- HW is HW0 - 1.
dec_hand(b, HW, HB0, HW, HB) :- HB is HB0 - 1.`,
      ex: R`
?- hand(b, 10, 7, H).
H = 7.

?- dec_hand(w, 10, 7, W, B).
W = 9, B = 7.`,
      note: 'Pattern matching on the first argument replaces an if / else.',
    },
    {
      type: 'diagram', title: '<code>legal_moves</code>: 4 situations',
      diagram: `<div class="flow" style="gap:18px">` + [
        ['1', 'game over', 'no moves'],
        ['2', 'drop phase', 'any empty square <b>except the centre</b>'],
        ['3', 'move phase, no chain', 'every normal slide'],
        ['4', 'move phase, in a chain', 'only the chain stone, only moves that capture again, plus <code>stop</code>'],
      ].map(([n, q, a]) => `<div class="frow"><span class="n" style="font-size:40px;width:60px">${n}</span>` +
        `<div class="q" style="width:470px;font-size:32px;padding:16px 24px">${q}</div><span class="y" style="font-size:36px;color:#fff">→</span>` +
        `<div class="a" style="font-size:30px;padding:16px 24px;max-width:700px">${a}</div></div>`).join('') + `</div>`,
      note: 'One clause per situation. The cut <code>!</code> says “this is the right case, do not try the clauses below”.',
    },
    ...steps({ type: 'code', title: '<code>legal_moves</code>', lang: 'prolog', code: LEGAL, size: 24 }, [
      { t: '1. game over', show: '1', note: '<span style="font-size:40px;color:#fff;font-weight:800">Phase = <code>over</code> → no moves: <code>[]</code></span>' },
      {
        t: '2. drop phase', show: '2-3', type: 'split', size: 22, ratio: 1.7,
        diagram: fig(grid({ size: 72, nums: true, cross: [12] }), '24 drops: every empty square<br><b>except the centre</b>'),
        note: '<span style="font-size:36px;color:#fff;font-weight:800">Any empty square except the centre (12)</span>',
      },
      {
        t: '3. normal turn', show: '4-5', note: '<span style="font-size:40px;color:#fff;font-weight:800">Chain = <code>none</code> → every normal slide</span>',
      },
      {
        t: '4. capture chain', show: '6-11', ex: R`
chain = 7  (a square)

Moves = [move(7, 8), stop]`,
        note: '<span style="font-size:32px;color:#fff;font-weight:800">Only the chain stone, only moves that capture again, plus <code>stop</code></span>',
      },
    ]),
    {
      type: 'split', title: '<code>slide_moves</code>', lang: 'prolog', size: 22, ratio: 1.35,
      code: R`
slide_moves(B, T, Moves) :-
    findall(move(I, J),
            ( cell(I, B, T),      % a square with my stone
              adj(I, _, J),       % a neighbour of it
              cell(J, B, e) ),    % that is empty
            Moves).`,
      ex: R`Moves = [move(1,0), move(1,2)]`,
      diagram: fig(grid({ size: 84, nums: true, board: B('.w...', '.b...', '.....', '.....', '.....'), arrows: [[1, 0], [1, 2], [1, 6, 'no']] }),
        'white on 1: 0 and 2 are empty, 6 is full'),
    },
    {
      type: 'diagram', title: 'Capturing = the sandwich',
      diagram: row(
        fig(grid({ size: 66, board: B('.....', 'w.bw.', '.....', '.....', '.....'), arrows: [[5, 6]] }), 'white slides 5 → 6'),
        arrow(''),
        fig(grid({ size: 66, board: B('.....', '.wbw.', '.....', '.....', '.....'), cross: [7] }), '7 is trapped in a line → <b>captured</b>'),
        `<div style="width:30px"></div>`,
        fig(grid({ size: 66, board: B('.....', '.....', '.wbw.', '.....', '.....') }), 'on the centre: <b>never</b> captured')),
      note: 'Only a stone that <b>moves</b> into place captures. Lines are straight: no diagonals.',
    },
    cases('<code>captures_for</code>: 3 questions per direction', [
      ['is the <b>next</b> square an enemy stone?', 'no → nothing in this direction'],
      ['is it <b>not</b> on the centre?', 'no → the centre is safe'],
      ['is the square <b>after it</b> my stone?', 'yes → <b>captured</b>'],
    ], 'White just moved a stone onto <code>To</code>. It looks up, down, left and right and asks these 3 questions each time.'),
    {
      type: 'split', title: '<code>captures_for</code>', lang: 'prolog', code: CAPS, size: 22, ratio: 2.05,
      ex: R`Caps = [8].`,
      diagram: capGrid({ cross: [8], cap: 'white moved onto <b>7</b> → captures <b>8</b>' }),
      note: '<code>findall</code> tries all 4 directions and keeps every <code>N</code> that passes the 3 questions. The same <code>D</code> twice = a straight line.',
    },
    {
      type: 'diagram', title: '<code>captures_for</code>: direction by direction',
      diagram: row(
        capGrid({ arrows: [[7, 2], [7, 12], [7, 6], [7, 8]], cap: 'white just moved onto <b>7</b>' }),
        table(['direction', 'next square', 'after it', 'captured?'], [
          ['up', '2 = white ✕', '–', 'no'],
          ['down', '12 = black, <b>centre</b> ✕', '–', 'no'],
          ['left', '6 = black ✓', '5 = empty ✕', 'no'],
          ['right', '8 = black ✓', '9 = white ✓', '<b>yes → 8</b>'],
        ], 'big')),
      note: 'Only the right side closes the sandwich, so <code>Caps = [8]</code>.',
    },
    {
      type: 'stack', title: '<code>move_captures</code>: “what if?”', lang: 'prolog', size: 25,
      code: R`
move_captures(B0, T, F, To, Caps) :-
    set_cell(F, e, B0, B1),
    set_cell(To, T, B1, B2),
    captures_for(B2, T, To, Caps).`,
      ex: R`
?- move_captures(B0, w, 6, 7, C).
C = [8].`,
      diagram: row(
        fig(grid({ size: 50, nums: true, board: B('.....', '.w.bw', '.....', '.....', '.....') }), '<b>B0</b>'),
        arrow('6 empty'),
        fig(grid({ size: 50, nums: true, board: B('.....', '...bw', '.....', '.....', '.....') }), '<b>B1</b>'),
        arrow('w on 7'),
        fig(grid({ size: 50, nums: true, board: B('.....', '..wbw', '.....', '.....', '.....'), cross: [8] }), '<b>B2</b> → [8]')),
      note: 'All on copies: the real board B0 is never changed.',
    },
    {
      type: 'split', title: '<code>can_capture_from</code>: the chain', lang: 'prolog', size: 23,
      code: R`
can_capture_from(B, T, P) :-
    adj(P, _, J), cell(J, B, e),
    move_captures(B, T, P, J, [_|_]), !.`,
      ex: R`
16 -> 11  captures []    no
16 -> 21  captures [22]  yes
!  -> stop, answer: true`,
      diagram: fig(grid({ size: 82, nums: true, board: B('.....', '.....', '.....', '.w.w.', '..bw.'), ring: [16], arrows: [[16, 11, 'no'], [16, 21]] }),
        'white just captured 17 with the stone on 16.<br>It can capture again → <b>still white’s turn</b>'),
      note: '<code>[_|_]</code> = at least one captured stone. The cut stops at the first one: we only need yes or no.',
    },
    {
      type: 'split', title: '<code>threats</code>', lang: 'prolog', size: 23,
      code: R`
threats(B, T, N) :-
    slide_moves(B, T, Moves),
    findall(C, ( member(move(F, To), Moves),
                 move_captures(B, T, F, To, Cs),
                 member(C, Cs) ),
            All),
    sort(All, Set),
    length(Set, N).`,
      ex: R`
All = [8, 16]
sort  -> no duplicates
N = 2`,
      diagram: fig(grid({ size: 80, nums: true, board: THREAT_BOARD, arrows: [[6, 7], [6, 11]], ring: [8, 16] }),
        'white threatens <b>8</b> (6 → 7) and <b>16</b> (6 → 11)'),
      note: 'How many <b>different</b> enemy stones I could capture next move. Used by eval.pl.',
    },
    cases('<code>apply_move</code>: 3 kinds of move', [
      ['<code>drop(I)</code>', 'place a stone on square I (drop phase)'],
      ['<code>move(From, To)</code>', 'slide one square, maybe capture (move phase)'],
      ['<code>stop</code>', 'end a capture chain'],
    ], 'One <code>apply_move_</code> clause per kind. An illegal move simply fails.'),
    {
      type: 'code', title: '<code>apply_move</code>: a drop', lang: 'prolog', size: 21,
      code: R`
apply_move(S0, M, S, Caps) :-
    apply_move_(S0, M, S, Caps), !.          % ! = one answer, no leftover choices

apply_move_(s(B0, drop, T, HW0, HB0, DL0, Ch, NC, W, _), drop(I), S, []) :-
    cell(I, B0, e), \+ centre(I),             % the square is empty and not the centre
    hand(T, HW0, HB0, H), H > 0,              % I still have a stone in my hand
    set_cell(I, T, B0, B),                    % put my stone on the board
    dec_hand(T, HW0, HB0, HW, HB),            % one stone less in my hand
    DL1 is DL0 - 1,                           % one drop less this turn
    drops_per_turn(DPT),                      % DPT = 2
    (   HW =:= 0, HB =:= 0                    % all 24 placed:
    ->  resolve_turn(s(B, move, b, 0, 0, 0, none, 0, W, false), S)     %  move phase, black first
    ;   DL1 =:= 0                             % my 2nd drop:
    ->  other(T, O), S = s(B, drop, O, HW, HB, DPT, Ch, NC, W, false)  %  other player, 2 drops
    ;   S = s(B, drop, T, HW, HB, DL1, Ch, NC, W, false)               % my 1st drop: I drop again
    ).`,
    },
    cases('After a drop: who plays?', [
      ['all 24 stones placed', 'move phase starts, <b>black</b> moves first'],
      ['2nd drop of the turn done', 'the other player gets 2 drops'],
      ['1st drop of the turn done', 'same player drops once more'],
    ], 'Lines 11–16 of the drop clause: an if / else if / else.'),
    {
      type: 'code', title: '<code>apply_move</code>: a slide', lang: 'prolog', size: 21,
      code: R`
apply_move_(s(B0, move, T, HW, HB, DL, Ch, NC0, W, _), move(F, To), S, Caps) :-
    cell(F, B0, T), adj(F, _, To), cell(To, B0, e),   % my stone, a neighbour, empty
    ( Ch == none -> true ; F == Ch ),                 % in a chain: only the chain stone
    move_captures(B0, T, F, To, Caps),                % what does this move capture?
    ( Ch == none -> true ; Caps \== [] ),             % in a chain: it must capture
    set_cell(F, e, B0, B1),                           % lift the stone
    set_cell(To, T, B1, B2),                          % put it on To
    remove_pieces(Caps, B2, B),                       % remove the captured stones
    ( Caps == [] -> NC is NC0 + 1 ; NC = 0 ),         % quiet moves: +1, or 0 after a capture
    other(T, O),
    (   Caps \== [],                                  % I captured,
        piece_count(B, O, NO), NO > 0,                % the enemy still has stones,
        can_capture_from(B, T, To)                    % and this stone can capture again:
    ->  S = s(B, move, T, HW, HB, DL, To, NC, W, false)             %  chain: still my turn
    ;   end_turn(s(B, move, T, HW, HB, DL, none, NC, W, false), S)  %  else: next player
    ).`,
    },
    {
      type: 'code', title: '<code>apply_move</code>: stop', lang: 'prolog', size: 22,
      code: R`
apply_move_(s(B, move, T, HW, HB, DL, Ch, NC, W, _), stop, S, []) :-
    Ch \== none,                                                % only inside a capture chain
    end_turn(s(B, move, T, HW, HB, DL, none, NC, W, false), S). % end the chain, next player

end_turn(s(B, move, T, HW, HB, DL, _, NC, W, _), S) :-
    other(T, O),                                                % the opponent
    resolve_turn(s(B, move, O, HW, HB, DL, none, NC, W, false), S).   % their turn (if they can move)`,
      note: 'Continuing a chain is optional: <code>stop</code> passes the turn. Every turn change goes through <code>resolve_turn</code>.',
    },
    {
      type: 'diagram', title: '<code>resolve_turn</code>: who plays next?',
      diagram: `<div class="flow">` + [
        ['1', 'player to move has <b>0 stones</b>', 'game over, opponent wins'],
        ['2', 'opponent has <b>0 stones</b>', 'game over, player wins'],
        ['3', '<b>50 moves</b> without a capture', 'game over, more stones wins'],
        ['4', 'player <b>can</b> slide', 'normal turn', 'o'],
        ['5', 'player blocked, opponent can move', 'opponent plays again (Extra = true)', 'o'],
        ['6', 'nobody can move', 'game over, more stones wins'],
      ].map(([n, q, a, o]) => `<div class="frow"><span class="n">${n}</span><div class="q">${q}</div><span class="y">yes →</span><div class="a ${o || ''}">${a}</div></div>`).join('') + `</div>`,
      note: 'Checked top to bottom, the first true line wins. Called after every turn change.',
    },
    {
      type: 'code', title: '<code>resolve_turn</code>', lang: 'prolog', size: 22,
      code: R`
resolve_turn(S0, S) :-
    S0 = s(B, move, T, HW, HB, DL, _, NC, _, _),
    other(T, O),
    piece_count(B, T, NT),
    piece_count(B, O, NO),
    max_quiet_moves(Max),
    (   NT =:= 0 -> S = s(B, over, T, HW, HB, DL, none, NC, O, false)                    % 1
    ;   NO =:= 0 -> S = s(B, over, T, HW, HB, DL, none, NC, T, false)                    % 2
    ;   NC >= Max -> winner_by_count(B, W),
                     S = s(B, over, T, HW, HB, DL, none, NC, W, false)                   % 3
    ;   slide_moves(B, T, [_|_]) -> S = S0                                               % 4
    ;   slide_moves(B, O, [_|_]) -> S = s(B, move, O, HW, HB, DL, none, NC, none, true)  % 5
    ;   winner_by_count(B, W), S = s(B, over, T, HW, HB, DL, none, NC, W, false)        % 6
    ).`,
      note: '<code>winner_by_count</code>: more stones wins, equal = draw.',
    },
    {
      type: 'stack', title: 'Case 5: a blocked player', lang: 'prolog', size: 22,
      code: R`
    ;   slide_moves(B, T, [_|_]) -> S = S0                                               % 4
    ;   slide_moves(B, O, [_|_]) -> S = s(B, move, O, HW, HB, DL, none, NC, none, true)  % 5`,
      diagram: fig(grid({ size: 66, nums: true, board: B('bw...', 'w....', '.....', '.....', '.....'), ring: [0], arrows: [[0, 'up', 'no'], [0, 'left', 'no']], pad: 56 }),
        'black to move, no empty neighbour → <b>white plays again</b>, Extra = true'),
    },
  ]));

  /* ---------- 4. eval.pl ---------- */
  const EVAL2 = R`
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
    V is Material + (SP - SO) + Mobility + Threat.`;
  const evalGrid = (o, cap) => fig(grid(Object.assign({ size: 62, nums: true, board: EVAL_BOARD }, o)), cap);

  S.push(...sec('eval.pl', [
    { type: 'section', num: '04', title: '<code>eval.pl</code>', sub: 'The AI cannot search to the end of the game, so it scores a position with one number' },
    {
      type: 'diagram', title: 'Why a heuristic? The tree is too big',
      diagram: fan(),
      note: 'Only the drop phase: 24 · 23 · 22 · … = 24! ≈ <b>6.2 × 10²³</b> lines, and the move phase comes after. ' +
        'At a million positions a second that is about <b>20 billion years</b>, so ai.pl looks 2–3 moves ahead and <code>evaluate</code> scores the rest.',
    },
    {
      type: 'diagram', title: 'A score = 4 ideas',
      diagram: row(
        box('Material', '100 per stone<br>(board + hand)', 'inv'),
        `<span style="font-size:50px">+</span>`,
        box('Safety', 'corner 12 · centre 15<br>edge 4'),
        `<span style="font-size:50px">+</span>`,
        box('Mobility', '4 per extra move'),
        `<span style="font-size:50px">+</span>`,
        box('Threats', '45 / 25 per stone<br>I can capture')),
      note: 'Each idea = <b>mine − the opponent’s</b>. Positive = good for the AI. Mobility and threats only count in the move phase.',
    },
    {
      type: 'diagram', title: 'Same stones, different value',
      diagram: row(
        fig(grid({ size: 76, board: B('w...w', '.....', '..w..', '.....', '.....'), text: { 0: '12', 4: '12', 12: '15' }, textSize: 24 }),
          'material 300 · safety <b>12 + 12 + 15 = 39</b>'),
        `<div style="font-size:44px;color:#777">vs</div>`,
        fig(grid({ size: 76, board: B('.....', '.www.', '.....', '.....', '.....'), text: { 6: '0', 7: '0', 8: '0' }, textSize: 24 }),
          'material 300 · safety <b>0</b>')),
      note: 'Corners can never be sandwiched and the centre is immune, so stones there are worth more.',
    },
    cases('<code>square_value</code>: how safe is a square?', [
      ['corner', '<b>12</b> &nbsp;never capturable'],
      ['centre (move phase)', '<b>15</b> &nbsp;immune to capture'],
      ['edge', '<b>4</b> &nbsp;only captured along the edge'],
      ['next to the centre (drop)', '<b>2</b> &nbsp;decides who gets the centre'],
      ['anything else', '<b>0</b>'],
    ], 'Checked top to bottom: the first match wins.'),
    {
      type: 'split', title: '<code>square_value</code>', lang: 'prolog', size: 24, ratio: 1.6,
      code: R`
square_value(I, _, 12)     :- corner(I), !.
square_value(I, move, 15)  :- centre(I), !.
square_value(I, _, 4)      :- edge(I), !.
square_value(I, drop, 2)   :- adj(I, _, C), centre(C), !.
square_value(_, _, 0).

safety(B, P, Phase, Score) :-
    aggregate_all(sum(V),
        ( cell(I, B, P), square_value(I, Phase, V) ),
        Score).`,
      diagram: row(
        fig(grid({ size: 46, text: VAL_MOVE, shade: SH_MOVE, textSize: 18 }), 'move phase'),
        fig(grid({ size: 46, text: VAL_DROP, shade: SH_DROP, textSize: 18 }), 'drop phase')),
      note: 'Ordered clauses + cut = a priority list. The last clause is the default (0).',
    },
    cases('<code>evaluate</code>: 2 cases', [
      ['the game is over', 'exact score: win <b>10000 + depth</b> · draw 0 · loss −10000 − depth'],
      ['a normal position', 'guess: material + safety + mobility + threats'],
    ], 'Clause 1 has a cut, so clause 2 is never tried for a finished game.'),
    {
      type: 'code', title: '<code>evaluate</code>: the game is over', lang: 'prolog', size: 26,
      code: R`
win_score(10000).

evaluate(S, P, D, V) :-
    game_over(S), !,
    arg(9, S, W),
    win_score(Win),
    (   W == P    -> V is Win + D
    ;   W == draw -> V = 0
    ;   V is -Win - D
    ).`,
      ex: R`
win, 3 depth left -> 10003
win, 1 depth left -> 10001
% earlier win = higher

loss, 3 left -> -10003
% the AI delays losing`,
    },
    ...steps({ type: 'split', title: '<code>evaluate</code>: a normal position', lang: 'prolog', code: EVAL2, size: 23, ratio: 1.3, exRight: true, exSize: 21 }, [
      {
        t: '1. material', show: '1-6', h: '4-6', ex: R`
white: 4 stones   black: 2
100 * (4 - 2) = 200`,
        diagram: evalGrid({}, 'move phase · white to move · AI = white'),
      },
      {
        t: '2. safety', show: '1,7', h: '7', ex: R`
white: 12 + 12 + 15 + 0 = 39
black:  0 + 4           = 4
39 - 4 = 35`,
        diagram: evalGrid({ text: { 0: '12', 4: '12', 12: '15', 13: '0', 8: '0', 19: '4' }, textSize: 20 }, 'value of each stone’s square'),
      },
      {
        t: '3. mobility + threats', show: '1,8-19', h: '8-16', ex: R`
mobility: 9 vs 6 slides
4 * (9 - 6)    = 12
threats: 1 vs 1, my turn
45*1 - 25*1    = 20`,
        diagram: evalGrid({ arrows: [[4, 3], [19, 18]], ring: [8, 13] }, 'white 4→3 takes 8 · black 19→18 takes 13'),
      },
      {
        t: '4. add it up', show: '1,20', h: '20', ex: R`
200 + 35 + 12 + 20 = 267`,
        diagram: evalGrid({}, 'score for white = <b>+267</b>'),
      },
    ]),
  ]));

  /* ---------- 5. ai.pl ---------- */
  const AB = () => ({
    v: 3, k: 'max', s: 'best', ann: 'α = 3 after a', c: [
      { v: 3, k: 'min', s: 'best', lab: 'a', c: [{ v: 3, s: 'best' }, { v: 12 }, { v: 8 }] },
      { v: 2, k: 'min', lab: 'b', ann: '2 ≤ α = 3\n→ cut!', c: [{ v: 2 }, { s: 'pruned' }, { s: 'pruned' }] },
      { v: 2, k: 'min', lab: 'c', c: [{ v: 14 }, { v: 5 }, { v: 2 }] },
    ],
  });
  const LOOP = R`
loop([], _, _, _, _, _, _, _, _, _, BV, BI, BV, BI, [], BM, BM).
loop([M|Ms], IsMax, S, D, A, B, P, Ply, H, I, BV0, BI0, BV, BI, [K|Ks], BM0, BM) :-
    apply_move(S, M, S1, Caps),                                   % 1
    D1 is D - 1, Ply1 is Ply + 1,
    state_key(S1, Key1),
    (   state_phase(S1, move), memberchk(Key1, H)                 % 2
    ->  repetition_leaf(S, S1, P, A, B, Ply1, V1, K0)
    ;   ab(S1, D1, A, B, P, Ply1, [Key1|H], V1, _, K0)
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
    ->  length(Ms, NP), flag(ab_pruned, X, X + NP),
        pruned_kids(Ms, S, Ply1, A1, B1, Ks),
        BV = BV1, BI = BI1, BM = BM1
    ;   I1 is I + 1,
        loop(Ms, IsMax, S, D, A1, B1, P, Ply, H, I1, BV1, BI1, BV, BI, Ks, BM1, BM)
    ).`;

  S.push(...sec('ai.pl', [
    { type: 'section', num: '05', title: '<code>ai.pl</code>', sub: 'Minimax with alpha-beta pruning' },
    {
      type: 'diagram', title: 'Minimax: look ahead, then back up',
      diagram: col(tree({
        v: 3, k: 'max', s: 'best', c: [
          { v: 3, k: 'min', s: 'best', lab: 'a', c: [{ v: 3, s: 'best' }, { v: 12 }, { v: 8 }] },
          { v: 2, k: 'min', lab: 'b', c: [{ v: 2 }, { v: 4 }, { v: 6 }] },
          { v: 2, k: 'min', lab: 'c', c: [{ v: 14 }, { v: 5 }, { v: 2 }] },
        ],
      }, { gx: 120, gy: 150, levels: ['MAX', 'MIN', 'leaf'] }),
        row(`<svg width="60" height="56"><rect x="6" y="4" width="48" height="48" fill="#000" stroke="#fff" stroke-width="3"/></svg>`,
          '<span style="font-size:24px;color:#ccc">MAX = AI to move</span>',
          `<svg width="60" height="56"><circle cx="30" cy="28" r="24" fill="#000" stroke="#fff" stroke-width="3"/></svg>`,
          '<span style="font-size:24px;color:#ccc">MIN = opponent</span>')),
      note: 'Leaves are scored by <code>evaluate</code>. <b>MIN</b> takes the lowest child, <b>MAX</b> the highest. Best move = <b>a</b>, worth 3.',
    },
    {
      type: 'diagram', title: 'Alpha-beta: skip what cannot matter',
      diagram: tree(AB(), { gx: 120, gy: 160, levels: ['MAX', 'MIN', 'leaf'], extraW: 180 }),
      note: '<b>α</b> = what MAX is already sure of. In <b>b</b>, MIN can already force ≤ 2 &lt; 3, so the rest of <b>b</b> is <b>pruned</b>. Same answer, fewer positions.',
    },
    {
      type: 'stack', title: 'In Seega, turns do not alternate', lang: 'prolog', size: 24,
      code: R`
state_turn(S, T),
( T == P -> IsMax = true ; IsMax = false ),   % MAX if it is the AI's turn`,
      diagram: `<div class="dcol" style="align-items:flex-start;gap:20px">` +
        `<div class="lane"><span class="name">drop phase</span>${chips(['w', 'w', 'b', 'b', 'w', 'w', 'b', 'b', '…'], '2 drops per turn')}</div>` +
        `<div class="lane"><span class="name">capture chain</span>${chips(['w', 'w', 'w', 'b'], 'white keeps capturing')}</div>` +
        `<div class="lane"><span class="name">blocked</span>${chips(['w', 'xb', 'w', 'w'], 'black cannot move')}</div></div>`,
      note: 'So MAX / MIN is decided by <b>whose turn it is</b>, not by “even depth = me”.',
    },
    {
      type: 'code', title: '<code>best_move</code>: the entry point', lang: 'prolog', size: 23,
      code: R`
best_move(S, Depth, Hist, Move, Value, Tree, Stats) :-
    state_turn(S, P),
    inf(Inf), NInf is -Inf,
    flag(ab_nodes, _, 0), flag(ab_pruned, _, 0),
    flag(ab_leaves, _, 0), flag(ab_id, _, 0),
    statistics(cputime, T0),
    state_key(S, K0),
    ab(S, Depth, NInf, Inf, P, 0, [K0|Hist], Value, Move, Root0),
    statistics(cputime, T1),
    Ms is round((T1 - T0) * 1000),
    flag(ab_nodes, N, N), flag(ab_pruned, Pr, Pr), flag(ab_leaves, L, L),
    put_dict(status, Root0, root, Root1),
    mark_path(Root1, Tree),
    Stats = _{nodes:N, pruned:Pr, leaves:L, time_ms:Ms, depth:Depth}.`,
      h: '2,8',
      note: 'P = the AI (MAX). Counters reset with <code>flag/3</code>, search from the root with (−∞, +∞), then tree + stats go to the website.',
    },
    cases('<code>ab</code>: 2 kinds of node', [
      ['depth used up, game over, or no legal move', '<b>leaf</b>: score it with <code>evaluate</code>'],
      ['otherwise', '<b>inner node</b>: sort the moves, search them with <code>loop</code>'],
    ], 'MAX or MIN is decided by whose turn it is.'),
    ...steps({
      type: 'code', title: '<code>ab</code>: one node of the search', lang: 'prolog', size: 24,
      code: R`
ab(S, D, A, B, P, Ply, H, V, Best, Node) :-
    flag(ab_nodes, N0, N0 + 1),
    flag(ab_id, Id, Id + 1),
    state_turn(S, T),
    ( T == P -> IsMax = true ; IsMax = false ),
    (   ( D =< 0 ; game_over(S) ; legal_moves(S, []) )
    ->  % LEAF
        evaluate(S, P, D, V),
        flag(ab_leaves, L, L + 1),
        Best = none, BI = -1, Kids = [], Status = leaf
    ;   % INNER NODE
        legal_moves(S, Ms0),
        order_moves(S, Ms0, Ms),
        inf(Inf),
        ( IsMax == true -> Init is -Inf ; Init = Inf ),
        loop(Ms, IsMax, S, D, A, B, P, Ply, H, 0, Init, -1, V, BI, Kids, none, Best),
        Status = explored
    ),
    % ... then build the tree node for the website:
    % Node = _{ id:Id, board:BS, max:IsMax, alpha:A, beta:B, score:V, status:Status, children:Kids, ... }.`,
    }, [
      { t: '1. leaf → evaluate', show: '1-10', h: '6-10', note: 'Depth used up, game over, or no legal move → score it.' },
      { t: '2. inner node → loop', show: '1,11-18', h: '12-17', note: 'Moves sorted best first. MAX starts at −∞, MIN at +∞.' },
    ]),
    cases('<code>loop</code>: what happens to each move', [
      ['no moves left', 'the best so far is the answer'],
      ['position seen before', 'score it with a penalty, no deeper search'],
      ['new position', '<code>ab</code>: search one level deeper'],
      ['<b>α ≥ β</b>', 'cut: the other moves are pruned'],
    ], 'After each move: keep it if it is the best so far, MAX raises α, MIN lowers β.'),
    ...steps({ type: 'code', title: '<code>loop</code>: one move at a time', lang: 'prolog', code: LOOP, size: 22 }, [
      { t: '1. play, search deeper', show: '1-10', h: '3-9', note: 'A repeated position gets a penalty instead of a deeper search.' },
      { t: '2. best so far + window', show: '2,11-18', h: '11-18', note: 'MAX raises α, MIN lowers β.' },
      { t: '3. α ≥ β → cut', show: '2,19-25', h: '19-24', note: 'The remaining moves are never searched: they are pruned. Otherwise go on with the next move.' },
    ]),
    {
      type: 'split', title: 'Repeated positions', lang: 'prolog', size: 24,
      code: R`
contempt(40).

repetition_leaf(S0, S, P, A, B, Ply, V, Node) :-
    ...
    evaluate(S, P, 0, E),
    contempt(C),
    state_turn(S0, Mover),
    ( Mover == P -> V is E - C ; V is E + C ),
    ...`,
      diagram: col(
        `<div style="display:flex;gap:16px;align-items:center;font:800 34px Consolas,monospace">A <span style="color:#777">→</span> B <span style="color:#777">→</span> <span style="border:3px dashed #fff;padding:2px 12px;border-radius:8px">A</span></div>`,
        table(['who repeats', 'score'], [['the AI', '<code>E − 40</code>'], ['the opponent', '<code>E + 40</code>']], 'big')),
      note: 'So two AIs cannot shuffle the same stone back and forth forever.',
    },
    cases('<code>move_key</code>: which move first?', [
      ['a capture', '<b>−10</b> per captured stone (tried first)'],
      ['a plain slide', '<b>0</b> (−1 into the centre)'],
      ['a drop', 'corner <b>0</b> · next to centre <b>1</b> · edge <b>2</b> · other <b>3</b>'],
      ['<code>stop</code>', '<b>100</b> (tried last)'],
    ], 'Smaller key = tried first. Good moves first = more alpha-beta cuts.'),
    ...steps({
      type: 'split', title: '<code>order_moves</code>: best moves first', lang: 'prolog', size: 23,
      code: R`
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
    K is -(10*N) - C.`,
    }, [
      {
        t: '1. sort by a key', show: '1-4',
        diagram: `<div class="seq" style="font-size:25px">` +
          `<div class="s"><code>[m1, m2, m3]</code></div>` +
          `<div class="s" style="color:#888">↓ map_list_to_pairs</div>` +
          `<div class="s"><code>[0-m1, -10-m2, 100-m3]</code></div>` +
          `<div class="s" style="color:#888">↓ keysort (small key first)</div>` +
          `<div class="s"><code>[-10-m2, 0-m1, 100-m3]</code></div>` +
          `<div class="s" style="color:#888">↓ pairs_values</div>` +
          `<div class="s"><code>[m2, m1, m3]</code></div></div>`,
        note: 'Alpha-beta prunes most when the best move is tried first.',
      },
      {
        t: '2. the keys', show: '6-18', size: 21,
        diagram: table(['move', 'key'], [['captures 2', '<code>-20</code>'], ['captures 1', '<code>-10</code>'], ['drop on a corner', '<code>0</code>'], ['drop on an edge', '<code>2</code>'], ['stop', '<code>100</code>']], 'big'),
        note: 'Smaller key = tried first: captures first, <code>stop</code> last.',
      },
    ]),
    {
      type: 'split', title: '<code>mark_path</code>: the expected line', lang: 'prolog', size: 23,
      code: R`
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
    ).`,
      diagram: tree({
        v: 5, k: 'max', s: 'best', c: [
          { v: 2, k: 'min', c: [{ v: 2 }, { v: 9 }] },
          { v: 5, k: 'min', s: 'best', c: [{ v: 5, s: 'best' }, { v: 7 }] },
          { v: 1, k: 'min', c: [{ v: 1 }, { s: 'pruned' }] },
        ],
      }, { gx: 84, gy: 150, r: 28 }),
      note: 'Follow <code>best</code> (the index of the best child) down the tree: that line is drawn on the website.',
    },
  ]));

  /* ---------- 6. api.pl ---------- */
  S.push(...sec('api.pl', [
    { type: 'section', num: '06', title: '<code>api.pl</code>', sub: 'The door between Python and Prolog: JSON in, JSON out' },
    {
      type: 'code', title: 'Loading the JSON library', lang: 'prolog', size: 26,
      code: R`
:- module(seega_api, [handle/2, serve_stdio/0]).

:- if(exists_source(library(json))).
:- use_module(library(json)).          % SWI-Prolog 10
:- else.
:- use_module(library(http/json)).     % SWI-Prolog 9 (Docker)
:- endif.
:- use_module(board).
:- use_module(rules).
:- use_module(eval).
:- use_module(ai).`,
      note: '<code>:- if</code> runs <b>while loading</b>, like <code>#ifdef</code> in C: one file works on both versions.',
    },
    cases('<code>handle</code>: 3 possible outcomes', [
      ['the command works', '<code>ok:true</code> + the answer'],
      ['the command fails (illegal move)', '<code>ok:false</code> + “Request failed”'],
      ['something crashes (bad JSON)', '<code>catch</code> → <code>ok:false</code> + the error'],
    ], 'Python always gets an answer back, and Prolog never crashes.'),
    {
      type: 'code', title: '<code>handle</code>: the main door', lang: 'prolog', size: 22,
      code: R`
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
    with_output_to(string(Out), json_write_dict(current_output, Resp, [width(0)])).`,
      note: 'JSON text → dict → run the command → <code>ok:true</code>. A failed move → <code>ok:false</code>. A crash is caught by <code>catch</code>.',
    },
    cases('<code>dispatch</code>: 5 commands', [
      ['<code>new</code>', 'a fresh game'],
      ['<code>legal</code>', 'the legal moves of a state'],
      ['<code>play</code>', 'play the human’s move'],
      ['<code>ai</code>', 'search and play the best move'],
      ['<code>hint</code>', 'search, but do not play'],
    ], 'One clause per command: Prolog picks it by the first argument.'),
    ...steps({
      type: 'code', title: '<code>dispatch</code>: one clause per command', lang: 'prolog', size: 24,
      code: R`
dispatch(new, _, _{state:J, legal:L}) :-
    initial_state(S),
    state_json(S, J),
    legal_json(S, L).

dispatch(play, Req, _{state:J, legal:L, captured:Caps, move:MJ, label:Lbl}) :-
    req_state(Req, S0),
    get_dict(move, Req, MJ0), json_move(MJ0, M),
    req_hist(Req, Hist),
    play_move(S0, M, Hist, S, Caps), !,
    move_json(M, MJ), move_label(M, Lbl),
    state_json(S, J),
    legal_json(S, L).

dispatch(ai, Req, Resp) :-
    search_request(Req, S0, M, V, Tree, Stats),
    req_hist(Req, Hist),
    play_move(S0, M, Hist, S, Caps), !,
    ...`,
    }, [
      { t: 'new', show: '1-4', note: 'A fresh game and its legal moves.' },
      { t: 'play', show: '6-13', note: 'Illegal move → <code>play_move</code> fails → <code>dispatch</code> fails → <code>ok:false</code>.' },
      { t: 'ai', show: '15-19', note: 'Search, then play the best move. <code>hint</code> searches but does not play.' },
    ]),
    {
      type: 'code', title: '<code>search_request</code>', lang: 'prolog', size: 24, codeFlex: 2,
      code: R`
search_request(Req, S, M, V, Tree, Stats) :-
    req_state(Req, S),
    \+ game_over(S),
    req_int(Req, depth, 2, 1, 10, Depth0),
    (   state_phase(S, drop)
    ->  Depth is min(Depth0, 3)
    ;   Depth = Depth0
    ),
    req_hist(Req, Hist),
    best_move(S, Depth, Hist, M, V, Tree, Stats),
    M \== none.`,
      ex: R`
depth sent 5   ->  5
depth sent 50  ->  10
missing        ->  2
drop phase     ->  at most 3`,
      exSize: 22,
    },
    {
      type: 'code', title: '<code>play_move</code>: threefold repetition', lang: 'prolog', size: 24,
      code: R`
play_move(S0, M, Hist, S, Caps) :-
    apply_move(S0, M, S1, Caps),
    (   state_phase(S1, move),
        state_key(S1, K),
        aggregate_all(count, member(K, Hist), N), N >= 2
    ->  over_by_count(S1, S)
    ;   S = S1
    ).`,
      ex: R`
A -> B -> A -> B -> A
history has A twice
-> 3rd time -> game over`,
      exSize: 22,
      note: 'The history comes from the browser (the server is stateless). A key = 25 board letters + whose turn.',
    },
    {
      type: 'code', title: 'State ⇄ JSON', lang: 'prolog', size: 21, codeFlex: 2.1,
      code: R`
state_json(s(B, Phase, T, HW, HB, DL, Ch, NC, W, X), J) :-
    board_string(B, BS),
    piece_count(B, w, CW), piece_count(B, b, CB),
    none_null(Ch, ChJ), none_null(W, WJ),
    J = _{board:BS, phase:Phase, turn:T, hand:_{w:HW, b:HB},
          drops_left:DL, chain:ChJ, nocap:NC, winner:WJ, extra_turn:X,
          counts:_{w:CW, b:CB}}.

none_null(none, null) :- !.
none_null(X, X).`,
      ex: R`
{"board": "eeeeeeeeeeeeeeeeeeeeeeeee",
 "phase": "drop",
 "turn": "w",
 "hand": {"w": 12, "b": 12},
 "drops_left": 2,
 "chain": null,
 "nocap": 0,
 "winner": null,
 "extra_turn": false,
 "counts": {"w": 0, "b": 0}}`,
      exLang: 'plain', exSize: 19, exLabel: 'json',
      note: 'The 10 numbered slots get names. <code>json_state</code> does the reverse.',
    },
    {
      type: 'stack', title: '<code>serve_stdio</code>: a loop without <code>while</code>', lang: 'prolog', size: 22,
      code: R`
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
    ).`,
      diagram: row(
        box('<code>repeat</code>', '', 'sm'), arrow(''),
        box('read a line', '', 'sm'), arrow(''),
        box('<code>handle</code> + write', '', 'sm inv'), arrow(''),
        box('<code>fail</code>', 'back to repeat ↺', 'sm'),
        `<div style="font-size:22px;color:#999;margin-left:20px">end of input →<br><code>!</code> stops it</div>`),
    },
  ]));

  window.SLIDES = S;
})();
