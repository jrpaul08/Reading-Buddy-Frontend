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
from fastapi.responses import HTMLResponse
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
        response = httpx.post(
            MODAL_ENDPOINT_URL,
            headers=headers,
            files=files,
            data=data,
            timeout=MODAL_HTTP_TIMEOUT,
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
    answer_path = call_modal(audio_path, book, chapter)
    return FileData(path=answer_path)


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
