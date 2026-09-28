import { useEffect, useState } from "react";
import { useNavigate, useParams, Navigate } from "react-router-dom";
import { BOOKS_BY_ID } from "../data/books";
import { useAuthTick } from "../components/AuthBridge";
import { listSaved, type SavedResponse } from "../lib/saved";

export default function QuestionsScreen() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const book = bookId ? BOOKS_BY_ID[bookId] : undefined;
  const [items, setItems] = useState<SavedResponse[] | null>(null);
  const [failed, setFailed] = useState(false);
  const authTick = useAuthTick();

  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;
    setFailed(false);
    setItems(null);
    listSaved()
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
  }, [bookId, authTick]);

  if (!book) return <Navigate to="/" replace />;

  return (
    <section className="view view--questions is-active" data-view="questions">
      <h1 className="setup__brand">{book.title}</h1>
      <div className="ornament ornament--labeled">
        <span className="ornament__line" />
        <span className="label-caps">Questions</span>
        <span className="ornament__line" />
      </div>
      <p className="questions__hint">
        After an answer, tap the mic and say “save this response.”
      </p>

      <div className="questions__list">
        {failed ? (
          <p className="questions__empty">Couldn't load your notes.</p>
        ) : items === null ? (
          <p className="questions__empty">Loading your notes…</p>
        ) : items.length === 0 ? (
          <p className="questions__empty">No questions saved for this book yet.</p>
        ) : (
          items.map((item, index) => (
            <details
              key={`${item.saved_at}-${item.question}-${index}`}
              className="question-leaf"
            >
              <summary>
                <span className="question-leaf__chapter">Chapter {item.chapter}</span>
                {item.question}
                <span className="question-leaf__hint">Tap to reveal the answer</span>
              </summary>
              <div className="question-leaf__body">
                <p className="question-leaf__answer">{item.answer}</p>
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
