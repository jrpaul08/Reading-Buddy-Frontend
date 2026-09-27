import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { SessionProvider } from "./session/SessionContext";
import { getSessionId } from "./lib/sessionId";
import { listSaved, savePair } from "./lib/saved";
import "./styles/global.css";

getSessionId();

if (import.meta.env.DEV) {
  Object.assign(window, { savePair, listSaved, getSessionId });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <App />
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>
);

// Register the service worker only in production builds, so dev hot-reload is
// never served stale from cache.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* PWA is a progressive enhancement; ignore registration failures. */
    });
  });
}
