import { useState } from "react";
import { useNavigate, useParams, Navigate } from "react-router-dom";
import { BOOKS_BY_ID, coverUrl } from "../data/books";

/* VIEW 2: session setup. Shows the chosen book and a chapter stepper, then
   sends the reader on to the warming screen. The book id comes from the URL
   (/setup/:bookId); the chosen chapter lives in local state for now and will
   move into shared session state in Iteration 4. */
export default function SessionSetupScreen() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const book = bookId ? BOOKS_BY_ID[bookId] : undefined;

  const [chapter, setChapter] = useState(1);

  // Unknown/mistyped book id: bounce back to the shelf rather than error.
  if (!book) return <Navigate to="/" replace />;

  const changeChapter = (next: number) =>
    setChapter(Math.min(Math.max(1, next), book.chapters));

  const beginReading = () => navigate("/warming");

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

        <button className="btn-primary" onClick={beginReading}>
          Begin Reading
        </button>
      </div>

      <button className="link-back" onClick={() => navigate("/")}>
        {"\u2039"} Back to the shelf
      </button>
    </section>
  );
}
