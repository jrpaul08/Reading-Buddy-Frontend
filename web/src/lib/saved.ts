import { LIST_URL, MOCK, SAVE_URL } from "./config";
import { getSessionId } from "./sessionId";

export type SavedResponse = {
  question: string;
  answer: string;
  book_id: string;
  chapter: number;
  saved_at: string;
};

export type SaveInput = {
  question: string;
  answer: string;
  book_id: string;
  chapter: number;
};

const MOCK_KEY = "reading-buddy-saved-pairs";

function readMockStore(): SavedResponse[] {
  try {
    const raw = localStorage.getItem(MOCK_KEY);
    return raw ? (JSON.parse(raw) as SavedResponse[]) : [];
  } catch {
    return [];
  }
}

function writeMockStore(items: SavedResponse[]) {
  localStorage.setItem(MOCK_KEY, JSON.stringify(items));
}

async function savePairRemote(input: SaveInput): Promise<{ status: string; count: number }> {
  const form = new FormData();
  form.append("session_id", getSessionId());
  form.append("question", input.question);
  form.append("answer", input.answer);
  form.append("book_id", input.book_id);
  form.append("chapter", String(input.chapter));

  const res = await fetch(SAVE_URL, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Save failed with HTTP ${res.status}`);
  return (await res.json()) as { status: string; count: number };
}

async function listSavedRemote(): Promise<SavedResponse[]> {
  const url = new URL(LIST_URL);
  url.searchParams.set("session_id", getSessionId());
  const res = await fetch(url);
  if (!res.ok) throw new Error(`List failed with HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? (data as SavedResponse[]) : [];
}

function savePairMock(input: SaveInput): { status: string; count: number } {
  const items = readMockStore();
  items.push({
    ...input,
    saved_at: new Date().toISOString(),
  });
  writeMockStore(items);
  return { status: "saved", count: items.length };
}

export async function savePair(
  input: SaveInput
): Promise<{ status: string; count: number }> {
  if (MOCK || !SAVE_URL) return savePairMock(input);
  return savePairRemote(input);
}

export async function listSaved(): Promise<SavedResponse[]> {
  if (MOCK || !LIST_URL) return readMockStore();
  return listSavedRemote();
}
