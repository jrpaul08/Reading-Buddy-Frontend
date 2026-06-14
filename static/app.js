import { Client, handle_file } from "https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js";

const BOOKS = window.READING_BUDDY_BOOKS || [];

const state = {
  book: null,
  chapter: 1,
};

/* --------------------------------------------------------------------------- */
/* State persistence                                                           */
/* --------------------------------------------------------------------------- */
function saveState() {
  if (state.book) {
    localStorage.setItem("reading-buddy-state", JSON.stringify({
      bookId: state.book.id,
      chapter: state.chapter,
    }));
  }
}

function loadState() {
  try {
    const saved = localStorage.getItem("reading-buddy-state");
    if (saved) {
      const data = JSON.parse(saved);
      const book = BOOKS.find(b => b.id === data.bookId);
      if (book) {
        state.book = book;
        state.chapter = data.chapter || 1;
        return true;
      }
    }
  } catch (e) {
    console.warn("Failed to load saved state:", e);
  }
  return false;
}

/* Bind a handler to respond to both touch and click without double-firing.
   On touch devices the touchend runs immediately; a flag suppresses the
   browser's subsequent ghost click. */
function addTap(el, handler) {
  let touchedAt = 0;
  el.addEventListener(
    "touchend",
    (event) => {
      touchedAt = Date.now();
      handler(event);
    },
    { passive: true }
  );
  el.addEventListener("click", (event) => {
    if (Date.now() - touchedAt < 500) return;
    handler(event);
  });
}

/* --------------------------------------------------------------------------- */
/* View navigation                                                             */
/* --------------------------------------------------------------------------- */
function showView(name, pushHistory = true) {
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("is-active", view.dataset.view === name);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
  
  if (pushHistory) {
    history.pushState({ view: name }, "", `#${name}`);
  }
}

// Handle browser back/forward buttons
window.addEventListener("popstate", (event) => {
  const view = event.state?.view || "shelf";
  showView(view, false);
});

/* --------------------------------------------------------------------------- */
/* Cover rendering - uses the supplied JPEG art served from /covers            */
/* --------------------------------------------------------------------------- */
function coverMarkup(book, { id = "" } = {}) {
  const src = `/covers/${encodeURIComponent(book.cover)}`;
  const idAttr = id ? ` id="${id}"` : "";
  return `<div class="book-cover"${idAttr}><img class="book-cover__img" src="${src}" alt="${book.title} cover" /></div>`;
}

/* --------------------------------------------------------------------------- */
/* VIEW 1: Shelf                                                               */
/* --------------------------------------------------------------------------- */
function renderShelf() {
  const row = document.getElementById("shelf-row");
  row.innerHTML = "";
  BOOKS.forEach((book) => {
    const btn = document.createElement("button");
    btn.className = "shelf__book";
    btn.innerHTML = coverMarkup(book);
    addTap(btn, () => openSetup(book));
    row.appendChild(btn);
  });
}

/* --------------------------------------------------------------------------- */
/* VIEW 2: Session Setup                                                       */
/* --------------------------------------------------------------------------- */
function openSetup(book) {
  state.book = book;
  state.chapter = 1;
  saveState();

  document.getElementById("setup-cover").outerHTML = coverMarkup(book, { id: "setup-cover" });
  document.getElementById("setup-title").textContent = book.title;
  document.getElementById("setup-byline").textContent = `${book.author} \u00b7 ${book.year}`;
  document.getElementById("setup-chapters").textContent = `${book.chapters} Chapters`;
  updateChapter(1);

  showView("session-setup");
}

function updateChapter(value) {
  const max = state.book ? state.book.chapters : 1;
  state.chapter = Math.min(Math.max(1, value), max);
  document.getElementById("chapter-value").textContent = state.chapter;
  
  // Also update reading session display if it exists
  const sessionChapterEl = document.getElementById("reading-session-chapter");
  const sessionChapterNumEl = document.getElementById("session-chapter-num");
  if (sessionChapterEl) {
    sessionChapterEl.textContent = `Chapter ${state.chapter}`;
  }
  if (sessionChapterNumEl) {
    sessionChapterNumEl.textContent = state.chapter;
  }
  
  saveState();
}

/* --------------------------------------------------------------------------- */
/* VIEW 3: Reading session                                                     */
/* --------------------------------------------------------------------------- */
function openReadingSession() {
  const book = state.book;
  document.getElementById("reading-session-author").textContent = book.author;
  document.getElementById("reading-session-title").textContent = book.title;
  updateReadingSessionChapter();
  setMicState("idle", "Tap to ask a question");
  showView("reading-session");
}

function updateReadingSessionChapter() {
  document.getElementById("reading-session-chapter").textContent = `Chapter ${state.chapter}`;
  document.getElementById("session-chapter-num").textContent = state.chapter;
}

const STATUS_TEXT = {
  idle: "Tap to ask a question",
  recording: "Listening\u2026 tap again when finished",
  processing: "Thinking\u2026",
  playing: "Speaking\u2026",
  "ready-to-play": "Tap to hear the answer",
  error: "Something went quiet. Tap to try again.",
};

function setMicState(micState, statusOverride) {
  document.getElementById("mic").dataset.state = micState;
  document.getElementById("reading-session-status").textContent =
    statusOverride ?? STATUS_TEXT[micState] ?? "";
}

/* --------------------------------------------------------------------------- */
/* Voice capture + backend call                                                */
/* --------------------------------------------------------------------------- */
let gradioClient = null;
let mediaRecorder = null;
let recordedChunks = [];
let pendingAnswerUrl = null;

function resolveAudioUrl(answer) {
  const raw =
    typeof answer === "string" ? answer : answer?.url || answer?.path || null;
  if (!raw) return null;
  if (raw.startsWith("http") || raw.startsWith("/")) return raw;
  return `/gradio_api/file=${raw}`;
}

async function getClient() {
  if (!gradioClient) {
    gradioClient = await Client.connect(window.location.origin);
  }
  return gradioClient;
}

async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  recordedChunks = [];
  mediaRecorder = new MediaRecorder(stream);

  mediaRecorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) recordedChunks.push(event.data);
  });

  mediaRecorder.addEventListener("stop", () => {
    stream.getTracks().forEach((track) => track.stop());
    const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType });
    sendQuestion(blob);
  });

  mediaRecorder.start();
  setMicState("recording");
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }
}

async function sendQuestion(blob) {
  setMicState("processing");
  try {
    const file = new File([blob], "question.webm", { type: blob.type || "audio/webm" });
    const client = await getClient();
    const result = await client.predict("/ask", {
      audio: handle_file(file),
      book_id: state.book.id,
      chapter: state.chapter,
    });

    const outputs = result?.data ?? result;
    const answer = Array.isArray(outputs) ? outputs[0] : outputs;
    const url = resolveAudioUrl(answer);
    if (!url) throw new Error("No audio returned from backend");

    await playAnswer(url);
  } catch (err) {
    console.error("Reading Buddy ask failed:", err);
    setMicState("error");
  }
}

function playAnswer(url) {
  const resolved = resolveAudioUrl(url);
  const audio = document.getElementById("answer-audio");

  return new Promise((resolve) => {
    audio.onended = () => {
      pendingAnswerUrl = null;
      setMicState("idle");
      resolve();
    };
    audio.onerror = () => {
      console.error("Audio playback failed:", audio.error);
      pendingAnswerUrl = resolved;
      setMicState("ready-to-play");
      resolve();
    };

    audio.src = resolved;
    setMicState("playing");
    audio.play().catch((err) => {
      // After a long Modal round-trip the original tap gesture is gone, so
      // browsers block autoplay — keep the URL and let the user tap to play.
      console.warn("Autoplay blocked, waiting for tap:", err);
      pendingAnswerUrl = resolved;
      setMicState("ready-to-play");
      resolve();
    });
  });
}

async function onMicTap() {
  const micState = document.getElementById("mic").dataset.state;
  if (micState === "processing" || micState === "playing") return;

  if (micState === "ready-to-play" && pendingAnswerUrl) {
    await playAnswer(pendingAnswerUrl);
    return;
  }

  if (micState === "recording") {
    stopRecording();
    return;
  }

  pendingAnswerUrl = null;
  try {
    await startRecording();
  } catch (err) {
    console.error("Microphone access failed:", err);
    setMicState("error", "Microphone unavailable. Check permissions.");
  }
}

/* --------------------------------------------------------------------------- */
/* Wire up events                                                              */
/* --------------------------------------------------------------------------- */
function init() {
  renderShelf();
  
  // Try to restore saved state and view
  const hash = window.location.hash.slice(1);
  const hasState = loadState();
  
  if (hasState && hash === "session-setup" && state.book) {
    // Restore session-setup view with saved book
    document.getElementById("setup-cover").outerHTML = coverMarkup(state.book, { id: "setup-cover" });
    document.getElementById("setup-title").textContent = state.book.title;
    document.getElementById("setup-byline").textContent = `${state.book.author} \u00b7 ${state.book.year}`;
    document.getElementById("setup-chapters").textContent = `${state.book.chapters} Chapters`;
    document.getElementById("chapter-value").textContent = state.chapter;
    showView("session-setup", false);
    history.replaceState({ view: "session-setup" }, "", "#session-setup");
  } else if (hasState && hash === "reading-session" && state.book) {
    // Restore reading-session view with saved book
    document.getElementById("reading-session-author").textContent = state.book.author;
    document.getElementById("reading-session-title").textContent = state.book.title;
    updateReadingSessionChapter();
    setMicState("idle", "Tap to ask a question");
    showView("reading-session", false);
    history.replaceState({ view: "reading-session" }, "", "#reading-session");
  } else {
    // Default to shelf
    showView("shelf", false);
    history.replaceState({ view: "shelf" }, "", "#shelf");
  }

  addTap(document.getElementById("chapter-prev"), () => updateChapter(state.chapter - 1));
  addTap(document.getElementById("chapter-next"), () => updateChapter(state.chapter + 1));
  addTap(document.getElementById("begin-reading"), openReadingSession);
  addTap(document.getElementById("setup-back"), () => showView("shelf"));
  addTap(document.getElementById("session-chapter-prev"), () => updateChapter(state.chapter - 1));
  addTap(document.getElementById("session-chapter-next"), () => updateChapter(state.chapter + 1));
  addTap(document.getElementById("reading-session-back"), () => {
    stopRecording();
    showView("session-setup");
  });
  addTap(document.getElementById("mic-button"), onMicTap);
}

init();
