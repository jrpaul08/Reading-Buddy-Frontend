"""Reading Buddy - a custom-frontend Gradio app.

We use ``gradio.Server`` (a FastAPI subclass with Gradio's API engine on top) so
we can serve a fully custom HTML/CSS/JS frontend while still getting Gradio's
queuing, file handling, and Hugging Face Spaces hosting.

Flow: browser records the reader's voice -> POSTs it to the ``ask`` API endpoint
-> Python forwards it to the Modal inference endpoint -> the spoken answer is
returned to the browser and auto-played.
"""

import json
import os
import shutil
import tempfile
from pathlib import Path

import httpx
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from gradio import Server
from gradio.data_classes import FileData

APP_DIR = Path(__file__).parent
STATIC_DIR = APP_DIR / "static"
COVERS_DIR = APP_DIR / "assets" / "book covers"
INDEX_HTML = APP_DIR / "index.html"

# --------------------------------------------------------------------------- #
# Book catalog - the single source of truth, injected into the page as JSON.
# Chapter counts/years are sensible real values for these public-domain works
# and can be edited freely.
# --------------------------------------------------------------------------- #
BOOKS = [
    {
        "id": "crime_and_punishment",
        "title": "Crime and Punishment",
        "author": "Fyodor Dostoevsky",
        "year": "1866",
        "chapters": 39,
        "cover": "C&P.jpeg",
    },
    {
        "id": "the_idiot",
        "title": "The Idiot",
        "author": "Fyodor Dostoevsky",
        "year": "1869",
        "chapters": 51,
        "cover": "TheIdiot.jpeg",
    },
    {
        "id": "the_count_of_monte_cristo",
        "title": "The Count of Monte Cristo",
        "author": "Alexandre Dumas",
        "year": "1846",
        "chapters": 117,
        "cover": "TCOMC.jpeg",
    },
    {
        "id": "pride_and_prejudice",
        "title": "Pride and Prejudice",
        "author": "Jane Austen",
        "year": "1813",
        "chapters": 61,
        "cover": "P&P.jpeg",
    },
]
BOOKS_BY_ID = {book["id"]: book for book in BOOKS}

# --------------------------------------------------------------------------- #
# Modal adapter. The real voice-to-voice pipeline lives on Modal; this is the
# thin client that talks to it. Configure via environment variables (set these
# as Secrets in your Hugging Face Space):
#   MODAL_ENDPOINT_URL - the deployed Modal web endpoint
#   MODAL_API_TOKEN    - optional bearer token for auth
# If MODAL_ENDPOINT_URL is unset we fall back to a dev mock so the whole flow is
# testable locally without Modal.
# --------------------------------------------------------------------------- #
MODAL_ENDPOINT_URL = os.environ.get("MODAL_ENDPOINT_URL")
MODAL_API_TOKEN = os.environ.get("MODAL_API_TOKEN")
# Voice-to-voice on Modal (transcribe + LLM + TTS) often exceeds 2 minutes on cold start.
MODAL_READ_TIMEOUT = float(os.environ.get("MODAL_READ_TIMEOUT", "600"))
MODAL_HTTP_TIMEOUT = httpx.Timeout(30.0, read=MODAL_READ_TIMEOUT)

# Dedicated Modal endpoint whose only job is to force the (GPU) container to load
# if it's cold and return once ready, so the reader's first question is fast.
# It does no real inference work. Set to an empty string to disable warm-up.
MODAL_WARMUP_URL = os.environ.get(
    "MODAL_WARMUP_URL",
    "https://pauljared48--reading-buddy-readingcompanion-warmup-endpoint.modal.run",
)
# A cold container takes ~25-40s to load; allow generous read headroom. The
# browser enforces its own shorter cap and proceeds regardless (see app.js).
MODAL_WARMUP_TIMEOUT = httpx.Timeout(
    30.0, read=float(os.environ.get("MODAL_WARMUP_READ_TIMEOUT", "120"))
)


def call_modal(audio_path: str, book: dict, chapter: int) -> str:
    """Send the reader's recorded question to Modal and return a path to the
    spoken answer audio. Falls back to a local echo mock when unconfigured."""
    if not MODAL_ENDPOINT_URL:
        return _mock_answer(audio_path)

    headers = {}
    if MODAL_API_TOKEN:
        headers["Authorization"] = f"Bearer {MODAL_API_TOKEN}"

    # TODO(modal-contract): adjust field names / payload shape to match the real
    # Modal endpoint (multipart vs. JSON+base64, response audio format, etc.).
    with open(audio_path, "rb") as audio_file:
        files = {"audio": (os.path.basename(audio_path), audio_file, "audio/webm")}
        data = {
            "book_id": book["id"],
            "book_title": book["title"],
            "author": book["author"],
            "chapter": str(chapter),
        }
        print(
            f"[call_modal] multipart form data: book_id={data['book_id']!r} chapter={data['chapter']!r}",
            flush=True,
        )
        # Modal can answer a slow call with a 303 redirect to a result URL, so
        # follow redirects rather than treating the 303 as a failure.
        response = httpx.post(
            MODAL_ENDPOINT_URL,
            headers=headers,
            files=files,
            data=data,
            timeout=MODAL_HTTP_TIMEOUT,
            follow_redirects=True,
        )
    response.raise_for_status()

    out_path = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
    with open(out_path, "wb") as out_file:
        out_file.write(response.content)
    return out_path


def _mock_answer(audio_path: str) -> str:
    """Dev fallback: echo the reader's own recording back so the end-to-end
    record -> send -> play loop can be exercised without Modal configured."""
    suffix = Path(audio_path).suffix or ".webm"
    out_path = tempfile.NamedTemporaryFile(suffix=suffix, delete=False).name
    shutil.copyfile(audio_path, out_path)
    return out_path


# --------------------------------------------------------------------------- #
# Gradio Server: serves the custom frontend and exposes the `ask` API.
# --------------------------------------------------------------------------- #
app = Server()
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.mount("/covers", StaticFiles(directory=str(COVERS_DIR)), name="covers")

ICONS_DIR = APP_DIR / "assets" / "icons"
app.mount("/icons", StaticFiles(directory=str(ICONS_DIR)), name="icons")


@app.api(name="ask", time_limit=int(MODAL_READ_TIMEOUT))
def ask(audio: FileData, book_id: str, chapter: int) -> FileData:
    """Receive a recorded question + reading context, return spoken answer audio.

    ``audio`` arrives as a Gradio FileData (already uploaded to the server); we
    read its local ``path``, hand it to Modal along with the book and current
    chapter (which gates spoilers), and return the answer as a FileData so the
    JS client receives a playable URL.
    """
    book = BOOKS_BY_ID.get(book_id, {"id": book_id, "title": book_id, "author": ""})
    audio_path = audio["path"] if isinstance(audio, dict) else audio.path
    print(
        f"[ask] received chapter={chapter} (type={type(chapter).__name__}) book_id={book_id!r}",
        flush=True,
    )
    answer_path = call_modal(audio_path, book, chapter)
    return FileData(path=answer_path)


@app.post("/warmup")
async def warmup() -> JSONResponse:
    """Nudge the Modal container awake so the reader's first spoken question is
    fast instead of eating the 25-40s cold-start delay.

    The frontend calls this once when a reading session begins. This is
    intentionally best-effort: on success we report the warm container, and on
    any failure/timeout we still return HTTP 200 with a non-ready status so the
    UI proceeds to the reading session unchanged. Worst case is identical to
    today (a slow first question), never an error screen.
    """
    if not MODAL_WARMUP_URL:
        # Warm-up disabled (e.g. local dev / mock mode): report ready instantly.
        return JSONResponse({"status": "ready"})

    try:
        # follow_redirects handles Modal's 303-while-busy behavior on slow calls.
        async with httpx.AsyncClient(
            follow_redirects=True, timeout=MODAL_WARMUP_TIMEOUT
        ) as client:
            response = await client.post(MODAL_WARMUP_URL)

        if response.status_code == 200:
            try:
                payload = response.json()
            except ValueError:
                payload = {}
            status = payload.get("status", "ready")
            print(f"[warmup] modal container ready (status={status!r})", flush=True)
            return JSONResponse({"status": status})

        print(
            f"[warmup] modal warm-up returned HTTP {response.status_code}; "
            "proceeding without warm confirmation",
            flush=True,
        )
    except Exception as exc:  # noqa: BLE001 - warm-up must never surface an error
        print(f"[warmup] failed ({type(exc).__name__}: {exc}); proceeding", flush=True)

    return JSONResponse({"status": "unavailable"})


def _asset_version() -> str:
    """Cache-busting token derived from the newest static asset mtime, so the
    browser refetches CSS/JS whenever we edit them (no stale caches in dev)."""
    files = [STATIC_DIR / "styles.css", STATIC_DIR / "app.js"]
    latest = max((f.stat().st_mtime for f in files if f.exists()), default=0)
    return str(int(latest))


@app.get("/", response_class=HTMLResponse)
async def homepage() -> str:
    """Serve the custom single-page frontend with the catalog injected as JSON."""
    html = INDEX_HTML.read_text(encoding="utf-8")
    html = html.replace("__BOOKS_JSON__", json.dumps(BOOKS))
    return html.replace("__ASSET_VERSION__", _asset_version())


if __name__ == "__main__":
    app.launch(show_error=True)
