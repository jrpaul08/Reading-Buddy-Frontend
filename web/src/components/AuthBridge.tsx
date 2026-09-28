import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import {
  markClerkAuthReady,
  notifyAuthChange,
  registerClerkTokenGetter,
  subscribeAuthChange,
} from "../lib/requestAuth";

/* Keeps requestAuth in sync with Clerk. Must sit under ClerkProvider. */
export default function AuthBridge() {
  if (!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) return null;
  return <AuthBridgeInner />;
}

function AuthBridgeInner() {
  const { getToken, isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    registerClerkTokenGetter(async () => {
      if (!isSignedIn) return null;
      return (await getToken()) ?? null;
    });
    markClerkAuthReady();
    notifyAuthChange();
  }, [getToken, isSignedIn, isLoaded]);

  return null;
}

/* Notes pages re-fetch when the reader signs in or out. */
export function useAuthTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => subscribeAuthChange(() => setTick((n) => n + 1)), []);
  return tick;
}
