import { ClerkProvider } from "@clerk/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { SessionProvider } from "./session/SessionContext";
import { getSessionId } from "./lib/sessionId";
import { getGuestSessionId, getRequestAuth } from "./lib/requestAuth";
import { addToGlossary, listGlossary } from "./lib/glossary";
import { isGlossaryCommand } from "./lib/glossaryCommand";
import { listSaved, savePair } from "./lib/saved";
import { clerkAppearance } from "./lib/clerkAppearance";
import "./styles/global.css";

getSessionId();

if (import.meta.env.DEV) {
  Object.assign(window, {
    savePair,
    listSaved,
    getSessionId,
    isGlossaryCommand,
    addToGlossary,
    listGlossary,
    getRequestAuth,
    getGuestSessionId,
  });
}

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? "";

const app = (
  <BrowserRouter>
    <SessionProvider>
      <App />
    </SessionProvider>
  </BrowserRouter>
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {clerkKey ? (
      <ClerkProvider
        publishableKey={clerkKey}
        afterSignOutUrl="/"
        appearance={clerkAppearance}
      >
        {app}
      </ClerkProvider>
    ) : (
      app
    )}
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