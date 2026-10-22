"""Seega HTTP API. The game is stateless on the server: the client sends the
current state with every request and Prolog returns the next one.

When STATIC_DIR points at the built React app (as in the Docker image), the
same server also serves the frontend, so everything runs on one port."""
import os
from pathlib import Path
from typing import Any, Literal, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from bridge import backend, solve

app = FastAPI(title="Seega API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Move(BaseModel):
    type: Literal["drop", "move", "stop"]
    to: Optional[int] = Field(None, ge=0, le=24)
    from_: Optional[int] = Field(None, alias="from", ge=0, le=24)

    def as_json(self) -> dict:
        data = {"type": self.type}
        if self.to is not None:
            data["to"] = self.to
        if self.from_ is not None:
            data["from"] = self.from_
        return data


class StateRequest(BaseModel):
    state: dict[str, Any]
    # Positions already played (25-char board + side to move), for repetition handling.
    history: list[str] = Field(default_factory=list, max_length=2000)


class PlayRequest(StateRequest):
    move: Move


class SearchRequest(StateRequest):
    depth: int = Field(3, ge=1, le=6)
    show_depth: int = Field(2, ge=1, le=3)


class AnalyzeRequest(PlayRequest):
    depth: int = Field(2, ge=1, le=4)


def _check_state(state: dict) -> None:
    board = state.get("board")
    if not isinstance(board, str) or len(board) != 25 or set(board) - set("ewb"):
        raise HTTPException(422, "state.board must be 25 characters of e/w/b")


def _run(cmd: str, **payload) -> dict:
    result = solve(cmd, **payload)
    if not result.get("ok"):
        raise HTTPException(400, result.get("error", "Prolog request failed"))
    return result


@app.get("/api/health")
def health():
    return {"ok": True, "bridge": backend().name}


@app.post("/api/new")
def new_game():
    return _run("new")


@app.post("/api/legal")
def legal(req: StateRequest):
    _check_state(req.state)
    return _run("legal", state=req.state)


@app.post("/api/play")
def play(req: PlayRequest):
    _check_state(req.state)
    return _run("play", state=req.state, move=req.move.as_json(), history=req.history)


@app.post("/api/ai")
def ai_move(req: SearchRequest):
    _check_state(req.state)
    return _run("ai", state=req.state, depth=req.depth, show_depth=req.show_depth, history=req.history)


@app.post("/api/hint")
def hint(req: SearchRequest):
    _check_state(req.state)
    return _run("hint", state=req.state, depth=req.depth, show_depth=req.show_depth, history=req.history)


@app.post("/api/analyze")
def analyze(req: AnalyzeRequest):
    _check_state(req.state)
    return _run("analyze", state=req.state, move=req.move.as_json(), depth=req.depth, history=req.history)


# Serve the built frontend last, so /api/* routes take precedence.
_static = os.environ.get("STATIC_DIR")
if _static and Path(_static).is_dir():
    app.mount("/", StaticFiles(directory=_static, html=True), name="frontend")
