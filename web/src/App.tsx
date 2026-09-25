import { Routes, Route, Navigate } from "react-router-dom";
import ShelfScreen from "./screens/ShelfScreen";
import SessionSetupScreen from "./screens/SessionSetupScreen";
import WarmingScreen from "./screens/WarmingScreen";
import ReadingSessionScreen from "./screens/ReadingSessionScreen";

/* Client-side routing. Each view is its own page/URL, but they all live under
   one SessionProvider (see main.tsx) so the warm-up we start doesn't reset when
   the route changes. */
export default function App() {
  return (
    <main id="app">
      <Routes>
        <Route path="/" element={<ShelfScreen />} />
        <Route path="/setup/:bookId" element={<SessionSetupScreen />} />
        <Route path="/warming" element={<WarmingScreen />} />
        <Route path="/session" element={<ReadingSessionScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  );
}
