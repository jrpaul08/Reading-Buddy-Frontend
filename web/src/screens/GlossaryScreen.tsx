import { useEffect, useState } from "react";
import { useNavigate, useParams, Navigate } from "react-router-dom";
import { BOOKS_BY_ID } from "../data/books";
import { listGlossary, type GlossaryItem } from "../lib/glossary";

export default function GlossaryScreen() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const book = bookId ? BOOKS_BY_ID[bookId] : undefined;
  const [items, setItems] = useState<GlossaryItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;
    setFailed(false);
    setItems(null);
    listGlossary()
      .then((all) => {
        if (cancelled) return;
        const forBook = all
          .filter((item) => item.book_id === bookId)
          .sort((a, b) => (a.saved_at < b.saved_at ? 1 : -1));
        setItems(forBook);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  if (!book) return <Navigate to="/" replace />;

  return (
    <section className="view view--questions is-active" data-view="glossary">
      <h1 className="setup__brand">{book.title}</h1>
      <div className="ornament ornament--labeled">
        <span className="ornament__line" />
        <span className="label-caps">Glossary</span>
        <span className="ornament__line" />
      </div>
      <p className="questions__hint">
        After a definition, tap the mic and say “add this to glossary.”
      </p>

      <div className="questions__list">
        {failed ? (
          <p className="questions__empty">Couldn't load your glossary.</p>
        ) : items === null ? (
          <p className="questions__empty">Loading your glossary…</p>
        ) : items.length === 0 ? (
          <p className="questions__empty">No words saved for this book yet.</p>
        ) : (
          items.map((item, index) => (
            <details
              key={`${item.saved_at}-${item.term}-${index}`}
              className="question-leaf"
            >
              <summary>
                <span className="question-leaf__chapter">Chapter {item.chapter}</span>
                {item.term}
                <span className="question-leaf__hint">Tap to reveal the definition</span>
              </summary>
              <div className="question-leaf__body">
                <p className="question-leaf__answer">{item.definition}</p>
              </div>
            </details>
          ))
        )}
      </div>

      <button className="link-back" onClick={() => navigate(`/setup/${book.id}`)}>
        {"\u2039"} Back to the book
      </button>
    </section>
  );
}
