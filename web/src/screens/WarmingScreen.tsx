import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSession } from "../session/SessionContext";
import { warmUpModel, WARM_MIN_MS } from "../lib/warmup";

/* Rotating, book-themed reassurances shown while the model container loads. */
function warmingMessages(title: string, chapter: number): string[] {
  return [
    "Lighting the reading lamp\u2026",
    `Pulling ${title} from the shelf\u2026`,
    `Turning to chapter ${chapter}\u2026`,
    "Marking your place\u2026",
    "Preparing spoiler-free answers\u2026",
    "Almost ready\u2026",
  ];
}

/* VIEW 2.5: the warm-up loading screen. On arrival it kicks off the (best-
   effort) backend warm-up, shows the book animation + rotating status text, and
   then advances to the reading session — whether the warm-up succeeded, failed,
   or timed out. Never blocks the reader on an error.

   Dev preview: open /warming?preview to see the animation without touching
   Modal (no cold start, no cost). It won't auto-advance; go back to exit. */
export default function WarmingScreen() {
  const navigate = useNavigate();
  const { book, chapter, markWarm } = useSession();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.has("preview");

  const title = book?.title ?? "your book";
  const [status, setStatus] = useState("Lighting the reading lamp\u2026");

  // No active book (e.g. deep-linked here directly): send back to the shelf,
  // unless we're just previewing the animation.
  useEffect(() => {
    if (!book && !isPreview) navigate("/", { replace: true });
  }, [book, isPreview, navigate]);

  // Rotating status messages. We just swap the current message on a single
  // timer; the fade-in is handled purely in CSS by keying the element (see the
  // render below), which avoids racing a JS timer against a CSS transition —
  // the source of the overlap/stutter on iOS Safari.
  useEffect(() => {
    const messages = warmingMessages(title, chapter);
    let index = 0;
    setStatus(messages[0]);
    const interval = setInterval(() => {
      index = (index + 1) % messages.length;
      setStatus(messages[index]);
    }, 2600);
    return () => clearInterval(interval);
  }, [title, chapter]);

  // Kick off the warm-up and advance when done. Skipped in preview mode.
  // startedRef makes this fire exactly once even under StrictMode's double-
  // mount in dev (so we never pay for two GPU pings). We only auto-advance if
  // the reader is still on the warming route — if they navigated away (e.g.
  // back button), we don't yank them forward.
  const startedRef = useRef(false);
  useEffect(() => {
    if (isPreview || startedRef.current) return;
    startedRef.current = true;

    (async () => {
      const started = Date.now();
      const ready = await warmUpModel();
      if (ready) markWarm();

      // Avoid a jarring one-frame flash if the warm-up resolves instantly.
      const elapsed = Date.now() - started;
      if (elapsed < WARM_MIN_MS) {
        await new Promise((r) => setTimeout(r, WARM_MIN_MS - elapsed));
      }
      if (window.location.pathname === "/warming") {
        navigate("/session", { replace: true });
      }
    })();
  }, [isPreview, markWarm, navigate]);

  return (
    <section className="view view--warming is-active" data-view="warming">
      <h1 className="setup__brand">READING BUDDY</h1>
      <div className="ornament ornament--labeled">
        <span className="ornament__line" />
        <span className="label-caps">Preparing Your Session</span>
        <span className="ornament__line" />
      </div>

      <div className="warming__stage" aria-hidden="true">
        <div className="warming__glow" />
        <div className="bookanim">
          <span className="bookanim__cover bookanim__cover--left" />
          <span className="bookanim__cover bookanim__cover--right" />
          <span className="bookanim__page bookanim__page--left" />
          <span className="bookanim__page bookanim__page--right" />
          <span className="bookanim__page bookanim__page--flip bookanim__page--flip-1" />
          <span className="bookanim__page bookanim__page--flip bookanim__page--flip-2" />
          <span className="bookanim__page bookanim__page--flip bookanim__page--flip-3" />
        </div>
      </div>

      <p className="warming__title">{title}</p>
      {/* key={status} makes React mount a fresh element per message, so the CSS
          fade-in animation replays cleanly and old/new text never coexist. */}
      <p className="warming__status" key={status} aria-live="polite">
        {status}
      </p>

      <div className="warming__meter" role="progressbar" aria-label="Preparing your reading session">
        <span className="warming__meter-fill" />
      </div>

      <p className="warming__note">This will take 1-2 mins.</p>
    </section>
  );
}
