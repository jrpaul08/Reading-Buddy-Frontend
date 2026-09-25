import { MOCK, WARMUP_URL } from "./config";

/* Warm-up tuning ------------------------------------------------------------ */
/* The Modal backend is a 3-container GPU pipeline: ~78-110s cold, ~5-9s warm.
   We trigger the warm-up when a session begins so the first question is fast. */
export const WARM_TTL_MS = 8 * 60 * 1000; // skip warm-up if warmed within this window
export const WARMUP_MAX_MS = 135 * 1000; // stop waiting and enter the session regardless
export const WARM_MIN_MS = 900; // let the loading screen breathe / avoid a jarring flash

/* Best-effort: ping Modal so it spins the GPU pipeline up. Resolves to true
   only when the backend confirms "ready". On timeout, network error, CORS
   rejection, or a non-ready response it resolves false — the caller proceeds to
   the session either way, so a failed warm-up is never worse than a slow first
   question. In mock mode (or with no endpoint configured) it resolves ready
   instantly without any network call. */
export async function warmUpModel(): Promise<boolean> {
  if (MOCK || !WARMUP_URL) return true;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WARMUP_MAX_MS);
  try {
    // Modal can answer a slow call with a 303 redirect; fetch follows redirects
    // by default, so we just await the final response.
    const res = await fetch(WARMUP_URL, {
      method: "POST",
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    return data?.status === "ready";
  } catch {
    // Aborted, timed out, CORS-blocked, or offline — proceed regardless.
    return false;
  } finally {
    clearTimeout(timer);
  }
}
