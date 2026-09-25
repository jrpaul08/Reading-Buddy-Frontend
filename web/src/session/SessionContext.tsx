import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Book } from "../data/books";
import { WARM_TTL_MS } from "../lib/warmup";

/* Shared session state that must survive navigation between pages (setup →
   warming → reading). Lives above the router so the warm-up we kick off doesn't
   reset when the route changes — the whole reason we use a client-side router
   instead of true separate HTML pages. */
type SessionValue = {
  book: Book | null;
  chapter: number;
  /** Set the active book + chapter (called from the setup page). */
  start: (book: Book, chapter: number) => void;
  /** Update just the chapter (called from the reading session controls). */
  setChapter: (chapter: number) => void;
  /** Record that the backend is confirmed warm right now. */
  markWarm: () => void;
  /** True if we warmed recently enough to skip a fresh warm-up. */
  isWarm: () => boolean;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [book, setBook] = useState<Book | null>(null);
  const [chapter, setChapter] = useState(1);

  // A ref (not state) because warmth is a timestamp we read on demand; it never
  // needs to trigger a re-render on its own.
  const lastWarmedAt = useRef(0);

  const start = useCallback((nextBook: Book, nextChapter: number) => {
    setBook(nextBook);
    setChapter(nextChapter);
  }, []);

  const markWarm = useCallback(() => {
    lastWarmedAt.current = Date.now();
  }, []);

  const isWarm = useCallback(
    () => lastWarmedAt.current > 0 && Date.now() - lastWarmedAt.current < WARM_TTL_MS,
    []
  );

  const value = useMemo<SessionValue>(
    () => ({ book, chapter, start, setChapter, markWarm, isWarm }),
    [book, chapter, start, markWarm, isWarm]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/* Convenience hook so pages can read/update session state. Throws if used
   outside the provider, which surfaces wiring mistakes early. */
export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
