/* Tight match for a short "save this" style utterance. Long questions that
   merely mention saving are left as normal questions. */
export function isSaveCommand(raw: string): boolean {
  const text = raw
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
  if (!text) return false;
  if (text.split(" ").length > 6) return false;
  return /^(please |can you |could you )?(save|remember) (this|that|it)( answer)?$/.test(
    text
  );
}
