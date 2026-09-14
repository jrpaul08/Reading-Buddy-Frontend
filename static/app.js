import { Client, handle_file } from "https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js";

const BOOKS = window.READING_BUDDY_BOOKS || [];

const state = {
  book: null,
  chapter: 1,
};

/* Warm-up tuning ------------------------------------------------------------ */
/* The Modal backend scales down after ~10 min idle and takes ~25-40s to reload.
   We trigger that reload when a session begins so the first question is fast. */
const WARM_TTL_MS = 8 * 60 * 1000; // skip warm-up if warmed within this window
const WARMUP_MAX_MS = 60 * 1000; // stop waiting and enter the session regardless
const WARM_MIN_MS = 900; // let the loading screen breathe / avoid a jarring flash

let lastWarmedAt = 0; // timestamp of the last confirmed-warm backend contact
let warmingInFlight = false; // guards against double taps on "Begin Reading"
let warmingStatusTimer = null;

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
/* VIEW 2.5: Warming up the backend                                            */
/* --------------------------------------------------------------------------- */

/* Rotating, book-themed reassurances shown while the model container loads.    */
function warmingMessages() {
  const title = state.book ? state.book.title : "your book";
  return [
    "Lighting the reading lamp\u2026",
    `Pulling ${title} from the shelf\u2026`,
    `Turning to chapter ${state.chapter}\u2026`,
    "Marking your place\u2026",
    "Preparing spoiler-free answers\u2026",
    "Almost ready\u2026",
  ];
}

function startWarmingMessages() {
  const statusEl = document.getElementById("warming-status");
  const titleEl = document.getElementById("warming-title");
  if (titleEl && state.book) {
    titleEl.textContent = state.book.title;
  }
  if (!statusEl) return;

  const messages = warmingMessages();
  let index = 0;
  statusEl.style.opacity = "1";
  statusEl.textContent = messages[0];

  stopWarmingMessages();
  warmingStatusTimer = setInterval(() => {
    index = (index + 1) % messages.length;
    statusEl.style.opacity = "0";
    setTimeout(() => {
      statusEl.textContent = messages[index];
      statusEl.style.opacity = "1";
    }, 350);
  }, 2600);
}

function stopWarmingMessages() {
  if (warmingStatusTimer) {
    clearInterval(warmingStatusTimer);
    warmingStatusTimer = null;
  }
}

/* Best-effort: ping the backend so it spins the model up. Resolves on ready,
   failure, or timeout - the caller proceeds to the session either way, so a
   failed warm-up is never worse than today's slow first question. */
async function warmUpModel() {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WARMUP_MAX_MS);
    const response = await fetch("/warmup", {
      method: "POST",
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (response.ok) {
      const data = await response.json().catch(() => null);
      if (data && data.status === "ready") {
        lastWarmedAt = Date.now();
        console.info("[warmup] backend reported ready");
      } else {
        console.info("[warmup] backend not confirmed ready; proceeding anyway");
      }
    }
  } catch (err) {
    // Aborted, timed out, or network error - proceed to the session regardless.
    console.warn("[warmup] proceeding without warm confirmation:", err);
  }

  // Avoid a jarring one-frame flash of the loading screen when it resolves fast.
  const elapsed = Date.now() - start;
  if (elapsed < WARM_MIN_MS) {
    await new Promise((resolve) => setTimeout(resolve, WARM_MIN_MS - elapsed));
  }
}

/* Dev-only: preview the loading page without touching Modal (no cold start, no
   cost). Open the app at "#warming-preview" to land here. It shows the real
   loading screen with its animation + rotating messages and never auto-advances,
   so you can iterate on the UI freely; remove the hash and reload to exit. */
function enterWarmingPreview() {
  if (!state.book) {
    state.book = BOOKS[0] || null;
    state.chapter = 1;
  }
  showView("warming", false);
  startWarmingMessages();
  history.replaceState({ view: "warming" }, "", "#warming-preview");
  console.info(
    "[preview] Loading page preview - no container started. " +
      "Remove #warming-preview from the URL and reload to exit."
  );
}

/* Entry point for the "Begin Reading" button. */
async function beginReading() {
  if (warmingInFlight) return;

  // Warmed recently? The container is still up - go straight in, no artificial wait.
  if (lastWarmedAt && Date.now() - lastWarmedAt < WARM_TTL_MS) {
    openReadingSession();
    return;
  }

  warmingInFlight = true;
  showView("warming", false);
  startWarmingMessages();
  try {
    await warmUpModel();
  } finally {
    stopWarmingMessages();
    warmingInFlight = false;
  }

  // Only advance if the user is still on the warming screen (didn't navigate away).
  const warmingActive = document
    .querySelector(".view--warming")
    ?.classList.contains("is-active");
  if (warmingActive) {
    openReadingSession();
  }
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
  recording: "Listening\u2026 tap mic when finished",
  processing: "Thinking\u2026",
  playing: "Speaking\u2026 tap to stop",
  "ready-to-play": "Tap to hear the answer",
  error: "Something went quiet. Tap to try again.",
};

const MIC_LABELS = {
  idle: "Tap to ask a question",
  recording: "Tap when finished speaking",
  processing: "Thinking",
  playing: "Tap to stop the answer",
  "ready-to-play": "Tap to hear the answer",
  error: "Tap to try again",
};

function setMicState(micState, statusOverride) {
  document.getElementById("mic").dataset.state = micState;
  document.getElementById("reading-session-status").textContent =
    statusOverride ?? STATUS_TEXT[micState] ?? "";
  document.getElementById("mic-button").ariaLabel =
    MIC_LABELS[micState] ?? MIC_LABELS.idle;
  document.getElementById("cancel-recording").hidden = micState !== "recording";
}

/* --------------------------------------------------------------------------- */
/* Voice capture + backend call                                                */
/* --------------------------------------------------------------------------- */
let gradioClient = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordingDiscarded = false;
let pendingAnswerUrl = null;
let activePlayResolve = null;

function stopAnswer() {
  const audio = document.getElementById("answer-audio");
  audio.pause();
  audio.currentTime = 0;
  pendingAnswerUrl = null;
  setMicState("idle");
  if (activePlayResolve) {
    const resolve = activePlayResolve;
    activePlayResolve = null;
    resolve();
  }
}

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
  recordingDiscarded = false;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  recordedChunks = [];
  mediaRecorder = new MediaRecorder(stream);

  mediaRecorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) recordedChunks.push(event.data);
  });

  mediaRecorder.addEventListener("stop", () => {
    stream.getTracks().forEach((track) => track.stop());
    if (recordingDiscarded) {
      recordedChunks = [];
      mediaRecorder = null;
      setMicState("idle");
      return;
    }
    const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType });
    mediaRecorder = null;
    sendQuestion(blob);
  });

  mediaRecorder.start();
  setMicState("recording");
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    recordingDiscarded = false;
    mediaRecorder.stop();
  }
}

function cancelRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    recordingDiscarded = true;
    mediaRecorder.stop();
  }
}

async function sendQuestion(blob) {
  setMicState("processing");
  try {
    const file = new File([blob], "question.webm", { type: blob.type || "audio/webm" });
    const client = await getClient();
    console.info("[ask] sending chapter=%s book_id=%s", state.chapter, state.book.id);
    const result = await client.predict("/ask", {
      audio: handle_file(file),
      book_id: state.book.id,
      chapter: state.chapter,
    });

    const outputs = result?.data ?? result;
    const answer = Array.isArray(outputs) ? outputs[0] : outputs;
    const url = resolveAudioUrl(answer);
    if (!url) throw new Error("No audio returned from backend");

    // A successful answer means the container is warm; refresh the warm-up TTL
    // so re-entering a session won't trigger a needless (billable) warm-up.
    lastWarmedAt = Date.now();

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
    activePlayResolve = resolve;

    audio.onended = () => {
      activePlayResolve = null;
      pendingAnswerUrl = null;
      setMicState("idle");
      resolve();
    };
    audio.onerror = () => {
      activePlayResolve = null;
      console.error("Audio playback failed:", audio.error);
      pendingAnswerUrl = resolved;
      setMicState("ready-to-play");
      resolve();
    };

    audio.src = resolved;
    setMicState("playing");
    audio.play().catch((err) => {
      activePlayResolve = null;
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
  if (micState === "processing") return;

  if (micState === "playing") {
    stopAnswer();
    return;
  }

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
  
  if (hash === "warming-preview") {
    // Dev preview of the loading page - no backend call, no container spin-up.
    enterWarmingPreview();
  } else if (hasState && hash === "session-setup" && state.book) {
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
  addTap(document.getElementById("begin-reading"), beginReading);
  addTap(document.getElementById("setup-back"), () => showView("shelf"));
  addTap(document.getElementById("session-chapter-prev"), () => updateChapter(state.chapter - 1));
  addTap(document.getElementById("session-chapter-next"), () => updateChapter(state.chapter + 1));
  addTap(document.getElementById("reading-session-back"), () => {
    cancelRecording();
    stopAnswer();
    showView("session-setup");
  });
  addTap(document.getElementById("cancel-recording"), cancelRecording);
  addTap(document.getElementById("mic-button"), onMicTap);
}

init();
