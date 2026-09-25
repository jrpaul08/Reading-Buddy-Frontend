import { useNavigate, useParams, Navigate } from "react-router-dom";
import { BOOKS_BY_ID } from "../data/books";

/* Saved questions for one book. The list is empty until save-from-session lands. */
export default function QuestionsScreen() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const book = bookId ? BOOKS_BY_ID[bookId] : undefined;

  if (!book) return <Navigate to="/" replace />;

  return (
    <section className="view view--questions is-active" data-view="questions">
      <h1 className="setup__brand">{book.title}</h1>
      <div className="ornament ornament--labeled">
        <span className="ornament__line" />
        <span className="label-caps">Questions</span>
        <span className="ornament__line" />
      </div>

      <div className="questions__list">
        <p className="questions__empty">No questions saved for this book yet.</p>
      </div>

      <button className="link-back" onClick={() => navigate(`/setup/${book.id}`)}>
        {"\u2039"} Back to the book
      </button>
    </section>
  );
}
