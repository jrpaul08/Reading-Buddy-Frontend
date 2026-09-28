/* Dual auth for save/list/position: Clerk Bearer when signed in, else a
   guest session_id. Guest id lives in memory only so it dies on refresh. */

export type RequestAuth =
  | { kind: "user"; token: string }
  | { kind: "guest"; sessionId: string };

let guestSessionId: string | undefined;
let getClerkToken: (() => Promise<string | null>) | null = null;

export function registerClerkTokenGetter(fn: (() => Promise<string | null>) | null) {
  getClerkToken = fn;
}

export function getGuestSessionId(): string {
  if (!guestSessionId) guestSessionId = crypto.randomUUID();
  return guestSessionId;
}

export async function getRequestAuth(): Promise<RequestAuth> {
  const token = getClerkToken ? await getClerkToken() : null;
  if (token) return { kind: "user", token };
  return { kind: "guest", sessionId: getGuestSessionId() };
}

export function authHeaders(auth: RequestAuth): HeadersInit {
  if (auth.kind === "user") return { Authorization: `Bearer ${auth.token}` };
  return {};
}

export function appendGuestToForm(form: FormData, auth: RequestAuth) {
  if (auth.kind === "guest") form.append("session_id", auth.sessionId);
}

export function appendGuestToUrl(url: URL, auth: RequestAuth) {
  if (auth.kind === "guest") url.searchParams.set("session_id", auth.sessionId);
}
