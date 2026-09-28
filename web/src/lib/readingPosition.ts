import { GET_POSITION_URL, MOCK, SAVE_POSITION_URL } from "./config";
import {
  appendGuestToForm,
  appendGuestToUrl,
  authHeaders,
  getRequestAuth,
} from "./requestAuth";

export type ReadingPosition = {
  book_id: string;
  chapter: number | null;
};

export type SavePositionInput = {
  book_id: string;
  chapter: number;
};

export type SavePositionResult = {
  status: string;
  book_id: string;
  chapter: number;
};

const mockByBook = new Map<string, number>();

async function savePositionRemote(
  input: SavePositionInput
): Promise<SavePositionResult> {
  const auth = await getRequestAuth();
  const form = new FormData();
  appendGuestToForm(form, auth);
  form.append("book_id", input.book_id);
  form.append("chapter", String(input.chapter));

  const res = await fetch(SAVE_POSITION_URL, {
    method: "POST",
    body: form,
    headers: authHeaders(auth),
  });
  if (!res.ok) throw new Error(`Save position failed with HTTP ${res.status}`);
  return (await res.json()) as SavePositionResult;
}

async function getPositionRemote(bookId: string): Promise<ReadingPosition> {
  const auth = await getRequestAuth();
  const url = new URL(GET_POSITION_URL);
  url.searchParams.set("book_id", bookId);
  appendGuestToUrl(url, auth);
  const res = await fetch(url, { headers: authHeaders(auth) });
  if (!res.ok) throw new Error(`Get position failed with HTTP ${res.status}`);
  const data = (await res.json()) as { book_id?: string; chapter?: number | null };
  return {
    book_id: data.book_id ?? bookId,
    chapter: data.chapter ?? null,
  };
}

function savePositionMock(input: SavePositionInput): SavePositionResult {
  mockByBook.set(input.book_id, input.chapter);
  return { status: "saved", book_id: input.book_id, chapter: input.chapter };
}

function getPositionMock(bookId: string): ReadingPosition {
  return { book_id: bookId, chapter: mockByBook.get(bookId) ?? null };
}

export async function saveReadingPosition(
  input: SavePositionInput
): Promise<SavePositionResult> {
  if (MOCK || !SAVE_POSITION_URL) return savePositionMock(input);
  return savePositionRemote(input);
}

export async function getReadingPosition(bookId: string): Promise<ReadingPosition> {
  if (MOCK || !GET_POSITION_URL) return getPositionMock(bookId);
  return getPositionRemote(bookId);
}
