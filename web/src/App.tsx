import { Routes, Route, Navigate, Link } from "react-router-dom";

/* Iteration 1 placeholder. Each of these becomes a real page in later
   iterations (Shelf, Session Setup, Warming, Reading Session). For now they
   just prove routing works and the ported theme/CSS loads. */
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
      </div>
    </section>
  );
}

export default function App() {
  return (
    <main id="app">
      <Routes>
        <Route path="/" element={<Placeholder title="READING BUDDY" next="/setup" />} />
        <Route path="/setup" element={<Placeholder title="Session Setup" next="/warming" />} />
        <Route path="/warming" element={<Placeholder title="Warming" next="/session" />} />
        <Route path="/session" element={<Placeholder title="Reading Session" next="/" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  );
}
