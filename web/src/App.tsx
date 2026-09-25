import { Routes, Route, Navigate, Link, useParams } from "react-router-dom";
import ShelfScreen from "./screens/ShelfScreen";
import { BOOKS_BY_ID } from "./data/books";

/* Placeholder pages for views we haven't built yet. Each becomes a real screen
   in a later iteration (Session Setup, Warming, Reading Session). */
function Placeholder({ title, next }: { title: string; next?: string }) {
  return (
    <section className="view is-active">
      <div className="shelf__intro">
        <h1 className="brand-title">{title}</h1>
        <p className="lede">Placeholder page — real content lands in a later iteration.</p>
        {next && (
          <p className="lede">
            <Link className="link-back" to={next}>
              Go to {next} &rsaquo;
            </Link>
          </p>
        )}
        <p className="lede">
          <Link className="link-back" to="/">
            &lsaquo; Back to the shelf
          </Link>
        </p>
      </div>
    </section>
  );
}

/* Temporary setup placeholder: proves the shelf click works by naming the
   picked book. Replaced by the real chapter-picker page in Iteration 3. */
function SetupPlaceholder() {
  const { bookId } = useParams();
  const book = bookId ? BOOKS_BY_ID[bookId] : undefined;
  return (
    <Placeholder title={book ? book.title : "Session Setup"} next="/warming" />
  );
}

export default function App() {
  return (
    <main id="app">
      <Routes>
        <Route path="/" element={<ShelfScreen />} />
        <Route path="/setup/:bookId" element={<SetupPlaceholder />} />
        <Route path="/warming" element={<Placeholder title="Warming" next="/session" />} />
        <Route path="/session" element={<Placeholder title="Reading Session" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  );
}
