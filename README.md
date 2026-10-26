# Seega — a Prolog game AI you can watch think

Seega is a two-player strategy game from ancient Egypt, played on a 5×5 board.
This project implements the full game with its **rules and AI written in SWI-Prolog**,
a **Python (FastAPI)** API, and a **React** interface that lets you play and
**watch the AI's minimax / alpha-beta search tree** for every move.

It is meant as a learning tool: hints show the engine's reasoning, and every
move of a game can be replayed together with the search tree the engine used.

```
┌──────────────────────┐   HTTP / JSON   ┌──────────────────────┐   JSON lines   ┌──────────────────────────┐
│  React (frontend/)   │ ──────────────▶ │  FastAPI (backend/)  │ ─────────────▶ │  SWI-Prolog (prolog/)    │
│  board, panels, tree │ ◀────────────── │  validation, routing │ ◀───────────── │  rules · eval · α-β      │
└──────────────────────┘                 └──────────────────────┘                └──────────────────────────┘
```

---

## Features

- **Complete Seega rules in Prolog**: placement phase (two stones per turn, centre stays empty),
  movement phase, custodian captures in several directions at once, capture chains, the
  immune centre square, extra turns when a player is blocked, and game-end rules.
- **Minimax with alpha-beta pruning**, depth 1–5, with move ordering and a heuristic that
  scores material, safe squares, mobility and threats.
- **Search tree visualisation**: every position the engine examined, drawn as a mini board.
  Pruned branches are red, the chosen line is green, and repeated positions are purple.
  Click any node to see its α/β window and score. You can replay the search step by step.
- **Browse the whole game**: open the tree for any past move. For moves made by a person,
  the engine shows what it would have played and marks the move that was actually played.
- **Hints**: ask the engine for a move and open its search tree to see why.
- **Modes**: you vs the AI, two players on one screen, or AI vs AI.
- **Interface**: a full-screen carved board (sandstone, acacia wood or basalt), animated
  stones, a sidebar with panels that slide in (Tree, Moves, Stats, Info, Settings),
  clocks, undo/redo and sound.

## Rules implemented

| Phase | Rule |
|---|---|
| Placement | Each player has 12 stones. Players place **2 stones per turn** on any empty cell except the **centre**. White places first. |
| Movement | When the board is full, Black moves first. A stone slides one cell up, down, left or right into an empty cell. |
| Capture | An enemy stone is captured when it is **sandwiched** between the moved stone and another friendly stone in a straight line. One move can capture in several directions. |
| Chains | If the moved stone can capture again, the same player may keep moving it (or stop). |
| Safety | A stone on the **centre cell cannot be captured**. Moving between two enemies is safe. Corner stones can never be captured. |
| Blocked | If a player cannot move, the opponent moves again until a move opens up. |
| End | Capture every enemy stone to win. After **50 moves without a capture**, or when the same position occurs **three times**, the player with more stones wins (equal is a draw). |

The engine penalises repeating a position, so two AIs cannot shuffle the same stones back and forth.

---

## Running it

### Option 1: Docker (simplest)

Requires only Docker.

```bash
docker build -t prolog-seega .
docker run --rm -p 8000:8000 prolog-seega
```

Open **http://localhost:8000**. The single container serves the game and the API.

### Option 2: Local development

Requirements:

- [SWI-Prolog](https://www.swi-prolog.org/download/stable) 9 or newer (`swipl` on your `PATH`)
- Python 3.10+
- Node.js 20+

**Windows (PowerShell):**

```powershell
winget install SWI-Prolog.SWI-Prolog          # if not installed yet

python -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
cd frontend; npm install; cd ..

.\start.ps1                                    # starts API + frontend and opens the browser
```

**macOS / Linux:**

```bash
# install SWI-Prolog first, e.g.  brew install swi-prolog   or   sudo apt install swi-prolog-nox
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
(cd frontend && npm install)

# terminal 1: API on :8000
cd backend && .venv/bin/uvicorn main:app --port 8000 --reload
# terminal 2: React dev server on :5173 (proxies /api to :8000)
cd frontend && npm run dev
```

Open **http://localhost:5173**.

> The Prolog process loads the `.pl` files when the API starts. Restart the API after
> changing Prolog code.

### Tests

```bash
swipl -g run_tests -t halt prolog/tests.pl        # Prolog rule & engine tests
cd backend && .venv/bin/python -m pytest -q        # API tests (needs swipl on PATH)
```

The Docker build also runs the Prolog tests and fails if any of them fail.

---

## Deploying on Coolify

The repository contains a production `Dockerfile`, so Coolify can build it directly.

1. In Coolify: **+ New Resource → Public Repository** (or *Private Repository* via your
   GitHub app) and enter `https://github.com/OmarTaheri/prolog-seega`.
2. Branch: `main`. **Build Pack: `Dockerfile`** (Dockerfile location `/Dockerfile`, base directory `/`).
3. **Ports Exposes: `8000`**.
4. Set your domain (e.g. `https://seega.example.com`). Coolify's proxy handles HTTPS.
5. Deploy. The image includes a health check on `GET /api/health`. You can also set
   it in Coolify under *Health Checks* with path `/api/health` and port `8000`.

Optional environment variables:

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8000` | Port the server listens on inside the container (keep it equal to *Ports Exposes*). |
| `SEEGA_BRIDGE` | `subprocess` | How Python talks to Prolog: `subprocess` (a persistent `swipl` process) or `janus` (needs `janus-swi` installed). |
| `STATIC_DIR` | `/app/static` | Where the built frontend is served from. Leave unset to run the API only. |

No database or volumes are needed. The server is stateless: the browser sends the game
state with every request.

---

## Project layout

```
prolog/
  board.pl     knowledge base: coord/3 and adj/3 facts generated for the 5×5 grid
  rules.pl     legal moves, applying moves, captures, chains, blocked turns, game end
  eval.pl      heuristic evaluation (material, safety, mobility, threats)
  ai.pl        minimax + alpha-beta that records the search tree; repetition handling
  api.pl       JSON entry point handle/2, stdio server
  tests.pl     plunit tests
backend/
  main.py      FastAPI routes (also serves the built frontend when STATIC_DIR is set)
  bridge.py    Python ↔ Prolog bridge (Janus if available, else a swipl subprocess)
  test_api.py  API tests
frontend/
  src/App.jsx                 layout, game flow, timeline (undo/redo, move history)
  src/components/Board.jsx    animated Seega board
  src/components/SearchTree.jsx   search tree view (d3-hierarchy + d3-zoom)
  src/components/Panels.jsx   settings, moves, stats, info panels
Dockerfile     multi-stage build: Node builds the UI, Python + SWI-Prolog run it
start.ps1      Windows helper that starts both dev servers
```

## API

All endpoints take and return JSON. The game state is included in every request.

| Method | Path | Body | Returns |
|---|---|---|---|
| `GET` | `/api/health` | – | `{ ok, bridge }` |
| `POST` | `/api/new` | – | initial `state` and `legal` moves |
| `POST` | `/api/play` | `state`, `move`, `history` | next `state`, `captured`, `legal` |
| `POST` | `/api/ai` | `state`, `depth`, `show_depth`, `history` | engine `move`, next `state`, search `tree`, `stats` |
| `POST` | `/api/hint` | `state`, `depth`, `show_depth`, `history` | suggested `move`, `tree`, `stats` (state unchanged) |

A move is `{"type":"drop","to":7}`, `{"type":"move","from":7,"to":12}` or `{"type":"stop"}`.
Squares are numbered 0–24 row by row from the top-left (`a5` = 0, `e1` = 24).
`history` is the list of positions already played (25-character board string + side to move).

## Python ↔ Prolog bridge

`backend/bridge.py` uses **Janus** (`janus_swi`) when it is installed. Otherwise it starts
one persistent `swipl` process that answers one JSON request per line
(`seega_api:serve_stdio/0`). Both paths call the same predicate, `seega_api:handle/2`.
On Windows, `pip install janus-swi` compiles a C extension and needs Microsoft C++ Build Tools.
The subprocess bridge needs nothing extra, and the Docker image uses it.
