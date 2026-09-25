import { MOCK, S2S_URL } from "./config";
import type { Book } from "../data/books";

/* Send the reader's recorded question to the Modal voice-to-voice endpoint and
   return a playable object URL for the spoken answer.

   The multipart shape mirrors the old Gradio backend's call_modal(): an "audio"
   file part plus book context and the current chapter (which gates spoilers).
   Modal can answer a slow call with a 303 redirect; fetch follows redirects by
   default, so we just await the final audio response.

   In mock mode (or with no endpoint configured) it echoes the recording back,
   so the record → send → play loop is fully testable without any GPU cost. */
export async function askQuestion(
  blob: Blob,
  book: Book,
  chapter: number
): Promise<string> {
  if (MOCK || !S2S_URL) {
    return URL.createObjectURL(blob);
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

  const answer = await res.blob();
  return URL.createObjectURL(answer);
}
