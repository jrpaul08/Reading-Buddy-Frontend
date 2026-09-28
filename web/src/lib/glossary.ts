import { GLOSSARY_ADD_URL, GLOSSARY_LIST_URL, MOCK } from "./config";
import { getSessionId } from "./sessionId";

export type GlossaryItem = {
  term: string;
  definition: string;
  book_id: string;
  chapter: number;
  saved_at: string;
};

export type GlossaryInput = {
  question: string;
  answer: string;
  book_id: string;
  chapter: number;
};

export type GlossaryAddResult =
  | { status: "saved"; term: string; definition: string; count: number }
  | { status: "not_vocabulary" };

const MOCK_KEY = "reading-buddy-glossary";

function readMockStore(): GlossaryItem[] {
  try {
    const raw = localStorage.getItem(MOCK_KEY);
    return raw ? (JSON.parse(raw) as GlossaryItem[]) : [];
  } catch {
    return [];
  }
}

function writeMockStore(items: GlossaryItem[]) {
  localStorage.setItem(MOCK_KEY, JSON.stringify(items));
}

async function addToGlossaryRemote(input: GlossaryInput): Promise<GlossaryAddResult> {
  const form = new FormData();
  form.append("session_id", getSessionId());
  form.append("question", input.question);
  form.append("answer", input.answer);
  form.append("book_id", input.book_id);
  form.append("chapter", String(input.chapter));

  const res = await fetch(GLOSSARY_ADD_URL, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Glossary add failed with HTTP ${res.status}`);
  const data = (await res.json()) as {
    status?: string;
    term?: string;
    definition?: string;
    count?: number;
  };
  if (data.status === "not_vocabulary") return { status: "not_vocabulary" };
  if (data.status === "saved" && data.term && data.definition) {
    return {
      status: "saved",
      term: data.term,
      definition: data.definition,
      count: Number(data.count) || 0,
    };
  }
  throw new Error("Unexpected glossary add response");
}

async function listGlossaryRemote(): Promise<GlossaryItem[]> {
  const url = new URL(GLOSSARY_LIST_URL);
  url.searchParams.set("session_id", getSessionId());
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Glossary list failed with HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? (data as GlossaryItem[]) : [];
}

function addToGlossaryMock(input: GlossaryInput): GlossaryAddResult {
  const items = readMockStore();
  const term = input.question.trim() || "term";
  const definition = input.answer.trim() || "definition";
  items.push({
    term,
    definition,
    book_id: input.book_id,
    chapter: input.chapter,
    saved_at: new Date().toISOString(),
  });
  writeMockStore(items);
  return { status: "saved", term, definition, count: items.length };
}

export async function addToGlossary(
  input: GlossaryInput
): Promise<GlossaryAddResult> {
  if (MOCK || !GLOSSARY_ADD_URL) return addToGlossaryMock(input);
  return addToGlossaryRemote(input);
}

export async function listGlossary(): Promise<GlossaryItem[]> {
  if (MOCK || !GLOSSARY_LIST_URL) return readMockStore();
  return listGlossaryRemote();
}
