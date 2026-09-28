import { Routes, Route, Navigate } from "react-router-dom";
import AccountBar from "./components/AccountBar";
import AuthBridge from "./components/AuthBridge";
import ClerkDevBridge from "./components/ClerkDevBridge";
import ShelfScreen from "./screens/ShelfScreen";
import SessionSetupScreen from "./screens/SessionSetupScreen";
import WarmingScreen from "./screens/WarmingScreen";
import ReadingSessionScreen from "./screens/ReadingSessionScreen";
import QuestionsScreen from "./screens/QuestionsScreen";
import GlossaryScreen from "./screens/GlossaryScreen";

/* Client-side routing. Each view is its own page/URL, but they all live under
   one SessionProvider (see main.tsx) so the warm-up we start doesn't reset when
   the route changes. */
export default function App() {
  return (
    <main id="app">
      <AuthBridge />
      <ClerkDevBridge />
      <AccountBar />
      <Routes>
        <Route path="/" element={<ShelfScreen />} />
        <Route path="/setup/:bookId" element={<SessionSetupScreen />} />
        <Route path="/setup/:bookId/questions" element={<QuestionsScreen />} />
        <Route path="/setup/:bookId/glossary" element={<GlossaryScreen />} />
        <Route path="/warming" element={<WarmingScreen />} />
        <Route path="/session" element={<ReadingSessionScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  );
}
