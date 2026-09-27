import { MOCK, S2S_URL } from "./config";
import type { Book } from "../data/books";

export type AskResult = {
  audioUrl: string;
  question: string;
  answer: string;
};

function decodeHeader(value: string | null): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/* Send the reader's recorded question to the Modal voice-to-voice endpoint.
   Response body is still raw WAV. Question/answer text arrive as percent-encoded
   headers (X-Question, X-Answer-Text). Mock mode echoes the recording and
   leaves the text empty. */
export async function askQuestion(
  blob: Blob,
  book: Book,
  chapter: number
): Promise<AskResult> {
  if (MOCK || !S2S_URL) {
    return { audioUrl: URL.createObjectURL(blob), question: "", answer: "" };
  }

  const form = new FormData();
  const file = new File([blob], "question.webm", {
    type: blob.type || "audio/webm",
  });
  form.append("audio", file, "question.webm");
  form.append("book_id", book.id);
  form.append("book_title", book.title);
  form.append("author", book.author);
  form.append("chapter", String(chapter));

  const res = await fetch(S2S_URL, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Modal responded with HTTP ${res.status}`);

  const audioUrl = URL.createObjectURL(await res.blob());
  return {
    audioUrl,
    question: decodeHeader(res.headers.get("X-Question")),
    answer: decodeHeader(res.headers.get("X-Answer-Text")),
  };
}
