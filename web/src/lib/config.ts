/* Runtime configuration, read from Vite env vars (see .env.example).
   These are baked into the client bundle at build time. Endpoint URLs are
   public; save/list/position still send a Clerk token or guest session_id. */

export const S2S_URL: string = import.meta.env.VITE_S2S_URL ?? "";
export const WARMUP_URL: string = import.meta.env.VITE_WARMUP_URL ?? "";
export const SAVE_URL: string = import.meta.env.VITE_SAVE_URL ?? "";
export const LIST_URL: string = import.meta.env.VITE_LIST_URL ?? "";
export const GLOSSARY_ADD_URL: string = import.meta.env.VITE_GLOSSARY_ADD_URL ?? "";
export const GLOSSARY_LIST_URL: string = import.meta.env.VITE_GLOSSARY_LIST_URL ?? "";
export const SAVE_POSITION_URL: string = import.meta.env.VITE_SAVE_POSITION_URL ?? "";
export const GET_POSITION_URL: string = import.meta.env.VITE_GET_POSITION_URL ?? "";

/* Mock mode: never touch Modal (no GPU cost). Explicitly enabled via
   VITE_MOCK=1, and also implied when no endpoint URLs are configured (e.g. a
   fresh checkout with no .env) so the UI is fully clickable out of the box. */
export const MOCK: boolean =
  import.meta.env.VITE_MOCK === "1" || (!S2S_URL && !WARMUP_URL);
