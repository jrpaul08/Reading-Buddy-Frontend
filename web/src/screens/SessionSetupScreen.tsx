import { useEffect, useState } from "react";
import { useNavigate, useParams, Navigate } from "react-router-dom";
import { BOOKS_BY_ID, coverUrl } from "../data/books";
import { useSession } from "../session/SessionContext";

/* VIEW 2: session setup. Book id comes from the URL (/setup/:bookId). */
export default function SessionSetupScreen() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const { start, isWarm } = useSession();
  const book = bookId ? BOOKS_BY_ID[bookId] : undefined;

  const [chapter, setChapter] = useState(1);
  const [notesOpen, setNotesOpen] = useState(false);

  useEffect(() => {
    if (!notesOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotesOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [notesOpen]);

  // Unknown/mistyped book id: bounce back to the shelf rather than error.
  if (!book) return <Navigate to="/" replace />;

  const changeChapter = (next: number) =>
    setChapter(Math.min(Math.max(1, next), book.chapters));

  const beginReading = () => {
    start(book, chapter);
    // Warmed recently? The pipeline is still up — skip the loading screen and
    // go straight in. Otherwise show the warm-up screen while it spins up.
    navigate(isWarm() ? "/session" : "/warming");
  };

  return (
    <section
      className="view view--session-setup is-active"
      data-view="session-setup"
    >
      <h1 className="setup__brand">READING BUDDY</h1>
      <div className="ornament">
        <span className="ornament__line" />
        <span className="ornament__dot">{"\u203b"}</span>
        <span className="ornament__line" />
      </div>

      <div className="setup__card">
        <div className="setup__head">
          <div className="book-cover" id="setup-cover">
            <img
              className="book-cover__img"
              src={coverUrl(book)}
              alt={`${book.title} cover`}
            />
          </div>
          <div className="setup__meta">
            <h2 className="setup__title">{book.title}</h2>
            <p className="setup__byline">
              {book.author} {"\u00b7"} {book.year}
            </p>
            <p className="label-caps setup__chapters">
              {book.chapters} Chapters
            </p>
          </div>
        </div>

        <div className="ornament ornament--labeled">
          <span className="ornament__line" />
          <span className="label-caps">Currently Reading</span>
          <span className="ornament__line" />
        </div>

        <p className="setup__chapter-label">Chapter</p>

        <div className="stepper">
          <button
            className="stepper__btn"
            aria-label="Previous chapter"
            onClick={() => changeChapter(chapter - 1)}
          >
            {"\u2039"}
          </button>
          <span className="stepper__value">{chapter}</span>
          <button
            className="stepper__btn"
            aria-label="Next chapter"
            onClick={() => changeChapter(chapter + 1)}
          >
            {"\u203a"}
          </button>
        </div>

        <div className="setup__actions">
          <button type="button" className="btn-primary" onClick={beginReading}>
            Begin Reading
          </button>
          <button
            type="button"
            className="notes-btn"
            aria-label="Your notes"
            onClick={() => setNotesOpen(true)}
          >
            <img src="/icons/notes-icon.png" alt="" />
          </button>
        </div>
      </div>

      <button className="link-back" onClick={() => navigate("/")}>
        {"\u2039"} Back to the shelf
      </button>

      {notesOpen && (
        <div
          className="notes-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="notes-modal-title"
          onClick={() => setNotesOpen(false)}
        >
          <div
            className="notes-modal__card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="ornament ornament--labeled">
              <span className="ornament__line" />
              <span className="label-caps" id="notes-modal-title">
                Your Notes
              </span>
              <span className="ornament__line" />
            </div>
            <div className="notes-modal__tiles">
              <button
                type="button"
                className="notes-tile notes-tile--ready"
                onClick={() => navigate(`/setup/${book.id}/questions`)}
              >
                Questions
                <small>Open</small>
              </button>
              <button type="button" className="notes-tile" disabled>
                Quotes
                <small>Soon</small>
              </button>
              <button type="button" className="notes-tile" disabled>
                Words
                <small>Soon</small>
              </button>
            </div>
            <button
              type="button"
              className="link-back notes-modal__close"
              onClick={() => setNotesOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
