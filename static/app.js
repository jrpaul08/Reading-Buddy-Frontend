import { Client, handle_file } from "https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js";

const BOOKS = window.READING_BUDDY_BOOKS || [];

const state = {
  book: null,
  chapter: 1,
};

/* --------------------------------------------------------------------------- */
/* View navigation                                                             */
/* --------------------------------------------------------------------------- */
function showView(name) {
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("is-active", view.dataset.view === name);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

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
    btn.addEventListener("click", () => openDetail(book));
    row.appendChild(btn);
  });
}

/* --------------------------------------------------------------------------- */
/* VIEW 2: Book detail                                                         */
/* --------------------------------------------------------------------------- */
function renderAuthorRail(currentBook) {
  const rail = document.getElementById("author-rail");
  const seen = new Set();
  rail.innerHTML = "";
  BOOKS.forEach((book) => {
    if (seen.has(book.author)) return;
    seen.add(book.author);
    const span = document.createElement("span");
    span.className = "author-rail__name";
    span.textContent = book.author;
    if (book.author === currentBook.author) span.classList.add("is-current");
    rail.appendChild(span);
  });
}

function openDetail(book) {
  state.book = book;
  state.chapter = 1;

  renderAuthorRail(book);
  document.getElementById("detail-cover").outerHTML = coverMarkup(book, { id: "detail-cover" });
  document.getElementById("detail-title").textContent = book.title;
  document.getElementById("detail-byline").textContent = `${book.author} \u00b7 ${book.year}`;
  document.getElementById("detail-chapters").textContent = `${book.chapters} Chapters`;
  updateChapter(1);

  showView("detail");
}

function updateChapter(value) {
  const max = state.book ? state.book.chapters : 1;
  state.chapter = Math.min(Math.max(1, value), max);
  document.getElementById("chapter-value").textContent = state.chapter;
}

/* --------------------------------------------------------------------------- */
/* VIEW 3: Reading session                                                     */
/* --------------------------------------------------------------------------- */
function openSession() {
  const book = state.book;
  document.getElementById("session-author").textContent = book.author;
  document.getElementById("session-title").textContent = book.title;
  document.getElementById("session-chapter").textContent = `Chapter ${state.chapter}`;
  setMicState("idle", "Tap to ask a question");
  showView("session");
}

const STATUS_TEXT = {
  idle: "Tap to ask a question",
  recording: "Listening\u2026 tap again when finished",
  processing: "Thinking\u2026",
  playing: "Speaking\u2026",
  error: "Something went quiet. Tap to try again.",
};

function setMicState(micState, statusOverride) {
  document.getElementById("mic").dataset.state = micState;
  document.getElementById("session-status").textContent =
    statusOverride ?? STATUS_TEXT[micState] ?? "";
}

/* --------------------------------------------------------------------------- */
/* Voice capture + backend call                                                */
/* --------------------------------------------------------------------------- */
let gradioClient = null;
let mediaRecorder = null;
let recordedChunks = [];

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

    const answer = result.data[0];
    const url = answer?.url || answer?.path;
    if (!url) throw new Error("No audio returned from backend");

    await playAnswer(url);
  } catch (err) {
    console.error("Reading Buddy ask failed:", err);
    setMicState("error");
  }
}

function playAnswer(url) {
  return new Promise((resolve) => {
    const audio = document.getElementById("answer-audio");
    audio.src = url;
    setMicState("playing");
    audio.onended = () => {
      setMicState("idle");
      resolve();
    };
    audio.onerror = () => {
      setMicState("error");
      resolve();
    };
    audio.play().catch(() => {
      setMicState("error");
      resolve();
    });
  });
}

async function onMicTap() {
  const micState = document.getElementById("mic").dataset.state;
  if (micState === "processing" || micState === "playing") return;

  if (micState === "recording") {
    stopRecording();
    return;
  }

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

  document.getElementById("chapter-prev").addEventListener("click", () => updateChapter(state.chapter - 1));
  document.getElementById("chapter-next").addEventListener("click", () => updateChapter(state.chapter + 1));
  document.getElementById("begin-reading").addEventListener("click", openSession);
  document.getElementById("detail-back").addEventListener("click", () => showView("shelf"));
  document.getElementById("session-back").addEventListener("click", () => {
    stopRecording();
    showView("detail");
  });
  document.getElementById("mic-button").addEventListener("click", onMicTap);
}

init();
