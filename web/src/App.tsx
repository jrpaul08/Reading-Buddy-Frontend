import { Routes, Route, Navigate, Link } from "react-router-dom";
import ShelfScreen from "./screens/ShelfScreen";
import SessionSetupScreen from "./screens/SessionSetupScreen";

/* Placeholder pages for views we haven't built yet. Each becomes a real screen
   in a later iteration (Warming, Reading Session). */
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

export default function App() {
  return (
    <main id="app">
      <Routes>
        <Route path="/" element={<ShelfScreen />} />
        <Route path="/setup/:bookId" element={<SessionSetupScreen />} />
        <Route path="/warming" element={<Placeholder title="Warming" next="/session" />} />
        <Route path="/session" element={<Placeholder title="Reading Session" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  );
}
