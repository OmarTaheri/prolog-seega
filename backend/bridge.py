"""Bridge between Python and the SWI-Prolog Seega solver.

Every call sends one JSON request to seega_api:handle/2 and gets one JSON
response back. Janus (janus_swi) embeds Prolog in this Python process; if it
is not available we fall back to a persistent `swipl` child process that
speaks the same JSON protocol line by line.
"""
import json
import os
import shutil
import subprocess
import threading
from pathlib import Path

PROLOG_DIR = Path(__file__).resolve().parent.parent / "prolog"
API_FILE = (PROLOG_DIR / "api.pl").as_posix()

_DEFAULT_SWIPL_HOME = Path(r"C:\Program Files\swipl")
if os.name == "nt" and _DEFAULT_SWIPL_HOME.exists():
    os.environ.setdefault("SWI_HOME_DIR", str(_DEFAULT_SWIPL_HOME))
    os.environ["PATH"] = str(_DEFAULT_SWIPL_HOME / "bin") + os.pathsep + os.environ.get("PATH", "")
    if hasattr(os, "add_dll_directory"):
        os.add_dll_directory(str(_DEFAULT_SWIPL_HOME / "bin"))


class JanusBackend:
    name = "janus"

    def __init__(self):
        import janus_swi as janus

        self._janus = janus
        janus.consult(API_FILE)
        self._lock = threading.Lock()

    def call(self, text: str) -> str:
        with self._lock:
            result = self._janus.query_once("seega_api:handle(In, Out)", {"In": text})
        return result["Out"]


class SubprocessBackend:
    name = "subprocess"

    def __init__(self):
        self._swipl = shutil.which("swipl") or str(_DEFAULT_SWIPL_HOME / "bin" / "swipl.exe")
        self._lock = threading.Lock()
        self._start()

    def _start(self):
        self._proc = subprocess.Popen(
            [self._swipl, "-q", "-g", "seega_api:serve_stdio", "-t", "halt", API_FILE],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            bufsize=1,
        )

    def call(self, text: str) -> str:
        with self._lock:
            if self._proc.poll() is not None:
                self._start()  # Prolog exited (crash or kill): start a fresh one
            self._proc.stdin.write(text.replace("\n", " ") + "\n")
            self._proc.stdin.flush()
            line = self._proc.stdout.readline()
        if not line:
            raise RuntimeError("Prolog process exited")
        return line


def _make_backend():
    if os.environ.get("SEEGA_BRIDGE") != "subprocess":
        try:
            return JanusBackend()
        except Exception as exc:  # janus missing or failed to load
            print(f"[bridge] Janus unavailable ({exc}); using swipl subprocess")
    return SubprocessBackend()


_backend = None


def backend():
    global _backend
    if _backend is None:
        _backend = _make_backend()
    return _backend


def solve(cmd: str, **payload) -> dict:
    """Send a command to Prolog and return the decoded response."""
    request = json.dumps({"cmd": cmd, **payload})
    return json.loads(backend().call(request))
