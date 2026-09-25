/* Runtime configuration, read from Vite env vars (see .env.example).
   These are baked into the client bundle at build time. The Modal endpoints
   are currently unauthenticated, so exposing them in the client is fine. */

export const S2S_URL: string = import.meta.env.VITE_S2S_URL ?? "";
export const WARMUP_URL: string = import.meta.env.VITE_WARMUP_URL ?? "";

/* Mock mode: never touch Modal (no GPU cost). Explicitly enabled via
   VITE_MOCK=1, and also implied when no endpoint URLs are configured (e.g. a
   fresh checkout with no .env) so the UI is fully clickable out of the box. */
export const MOCK: boolean =
  import.meta.env.VITE_MOCK === "1" || (!S2S_URL && !WARMUP_URL);
