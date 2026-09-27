const STORAGE_KEY = "reading-buddy-session-id";

/* One stable id per browser. Created on first visit, then reused for every
   save and list call so this reader's notes stay grouped together. */
export function getSessionId(): string {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  const id = crypto.randomUUID();
  localStorage.setItem(STORAGE_KEY, id);
  return id;
}
