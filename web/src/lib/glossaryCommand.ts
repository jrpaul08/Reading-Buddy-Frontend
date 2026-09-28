/* Tight match for a short "add this to glossary" utterance. Long questions
   that merely mention the glossary are left as normal questions. */
export function isGlossaryCommand(raw: string): boolean {
  const text = raw
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
  if (!text) return false;
  if (text.split(" ").length > 8) return false;
  return /^(please |can you |could you )?(add|put|save) (this|that|it)( word)? (to|in) (the )?glossary$/.test(
    text
  );
}
