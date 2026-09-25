import { useEffect, useRef, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useSession } from "../session/SessionContext";
import { askQuestion } from "../lib/modal";

type MicState =
  | "idle"
  | "recording"
  | "processing"
  | "playing"
  | "ready-to-play"
  | "error";

const STATUS_TEXT: Record<MicState, string> = {
  idle: "Tap to ask a question",
  recording: "Listening\u2026 tap mic when finished",
  processing: "Thinking\u2026",
  playing: "Speaking\u2026 tap to stop",
  "ready-to-play": "Tap to hear the answer",
  error: "Something went quiet. Tap to try again.",
};

const MIC_LABELS: Record<MicState, string> = {
  idle: "Tap to ask a question",
  recording: "Tap when finished speaking",
  processing: "Thinking",
  playing: "Tap to stop the answer",
  "ready-to-play": "Tap to hear the answer",
  error: "Tap to try again",
};

/* VIEW 3: the reading session. Tap the mic to record a question, which is sent
   to Modal; the spoken answer plays back automatically (with a tap-to-play
   fallback when the browser blocks autoplay after the long round-trip). Ported
   from the old app.js mic state machine. */
export default function ReadingSessionScreen() {
  const navigate = useNavigate();
  const { book, chapter, setChapter, markWarm } = useSession();

  const [micState, setMicState] = useState<MicState>("idle");
  const [statusText, setStatusText] = useState(STATUS_TEXT.idle);

  // Imperative bits that shouldn't trigger re-renders.
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const discardedRef = useRef(false);
  const pendingUrlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Clean up any in-flight recording/playback if the reader leaves the page.
  // Uses only refs so it can run before the early return below (Rules of Hooks:
  // all hooks must run on every render, in the same order).
  useEffect(() => {
    return () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state === "recording") {
        discardedRef.current = true;
        recorder.stop();
      }
      audioRef.current?.pause();
    };
  }, []);

  // No active book (deep-linked here directly): return to the shelf.
  if (!book) return <Navigate to="/" replace />;

  const setMic = (state: MicState, override?: string) => {
    setMicState(state);
    setStatusText(override ?? STATUS_TEXT[state]);
  };

  const changeChapter = (next: number) =>
    setChapter(Math.min(Math.max(1, next), book.chapters));

  /* ---- Playback ---------------------------------------------------------- */
  const playAnswer = (url: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = url;

    audio.onended = () => {
      pendingUrlRef.current = null;
      setMic("idle");
    };
    audio.onerror = () => {
      pendingUrlRef.current = url;
      setMic("ready-to-play");
    };

    setMic("playing");
    audio.play().catch(() => {
      // After a long Modal round-trip the original tap gesture is gone, so
      // browsers block autoplay — keep the URL and let the user tap to play.
      pendingUrlRef.current = url;
      setMic("ready-to-play");
    });
  };

  const stopAnswer = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    pendingUrlRef.current = null;
    setMic("idle");
  };

  /* ---- Send to backend --------------------------------------------------- */
  const sendQuestion = async (blob: Blob) => {
    setMic("processing");
    try {
      const url = await askQuestion(blob, book, chapter);
      // A successful answer means the pipeline is warm; refresh the TTL so
      // re-entering a session won't trigger a needless (billable) warm-up.
      markWarm();
      playAnswer(url);
    } catch (err) {
      console.error("Reading Buddy ask failed:", err);
      setMic("error");
    }
  };

  /* ---- Recording --------------------------------------------------------- */
  const startRecording = async () => {
    discardedRef.current = false;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    });

    recorder.addEventListener("stop", () => {
      stream.getTracks().forEach((track) => track.stop());
      if (discardedRef.current) {
        chunksRef.current = [];
        mediaRecorderRef.current = null;
        setMic("idle");
        return;
      }
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
      mediaRecorderRef.current = null;
      void sendQuestion(blob);
    });

    recorder.start();
    setMic("recording");
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      discardedRef.current = false;
      recorder.stop();
    }
  };

  const cancelRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      discardedRef.current = true;
      recorder.stop();
    }
  };

  /* ---- Mic tap: the state machine --------------------------------------- */
  const onMicTap = async () => {
    if (micState === "processing") return;
    if (micState === "playing") return stopAnswer();
    if (micState === "ready-to-play" && pendingUrlRef.current) {
      return playAnswer(pendingUrlRef.current);
    }
    if (micState === "recording") return stopRecording();

    pendingUrlRef.current = null;
    try {
      await startRecording();
    } catch (err) {
      console.error("Microphone access failed:", err);
      setMic("error", "Microphone unavailable. Check permissions.");
    }
  };

  const leaveSession = () => {
    cancelRecording();
    stopAnswer();
    navigate(`/setup/${book.id}`);
  };

  return (
    <section
      className="view view--reading-session is-active"
      data-view="reading-session"
    >
      <header className="reading-session__head">
        <p className="reading-session__author">{book.author}</p>
        <h2 className="reading-session__title">{book.title}</h2>
        <div className="ornament ornament--labeled">
          <span className="ornament__line" />
          <span className="label-caps">Chapter {chapter}</span>
          <span className="ornament__line" />
        </div>
      </header>

      <div className="reading-session__chapter-control">
        <button
          className="reading-session__chapter-btn"
          aria-label="Previous chapter"
          onClick={() => changeChapter(chapter - 1)}
        >
          {"\u2039"}
        </button>
        <span className="reading-session__chapter-num">{chapter}</span>
        <button
          className="reading-session__chapter-btn"
          aria-label="Next chapter"
          onClick={() => changeChapter(chapter + 1)}
        >
          {"\u203a"}
        </button>
      </div>

      <div className="mic" data-state={micState}>
        <span className="mic__ring mic__ring--outer" />
        <span className="mic__ring mic__ring--mid" />
        <button
          className="mic__button"
          aria-label={MIC_LABELS[micState]}
          onClick={onMicTap}
        >
          <svg className="mic__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
            <path
              d="M5 11a7 7 0 0 0 14 0M12 18v3"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <p className="reading-session__status">{statusText}</p>
      <button
        type="button"
        className="recording-cancel"
        aria-label="Cancel question"
        hidden={micState !== "recording"}
        onClick={cancelRecording}
      >
        <svg className="recording-cancel__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
          <path
            d="M5 11a7 7 0 0 0 14 0M12 18v3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      <div className="ornament reading-session__footer">
        <span className="ornament__line" />
        <img src="/icons/book_icon.png" alt="" className="ornament__icon" aria-hidden="true" />
        <span className="ornament__line" />
      </div>

      <button className="link-back" onClick={leaveSession}>
        {"\u2039"} Leave session
      </button>

      <audio ref={audioRef} hidden />
    </section>
  );
}
