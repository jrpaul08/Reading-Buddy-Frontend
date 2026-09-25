import { useNavigate, useParams, Navigate } from "react-router-dom";
import { BOOKS_BY_ID } from "../data/books";
import { questionsForBook } from "../data/questions";

export default function QuestionsScreen() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const book = bookId ? BOOKS_BY_ID[bookId] : undefined;
  const items = bookId ? questionsForBook(bookId) : [];

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
        {items.length === 0 ? (
          <p className="questions__empty">No questions saved for this book yet.</p>
        ) : (
          items.map((item) => (
            <details key={item.id} className="question-leaf">
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
