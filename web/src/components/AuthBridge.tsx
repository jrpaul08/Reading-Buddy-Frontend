import { useEffect } from "react";
import { useAuth } from "@clerk/react";
import { registerClerkTokenGetter } from "../lib/requestAuth";

/* Keeps requestAuth in sync with Clerk. Must sit under ClerkProvider. */
export default function AuthBridge() {
  if (!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) return null;
  return <AuthBridgeInner />;
}

function AuthBridgeInner() {
  const { getToken, isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    registerClerkTokenGetter(async () => {
      if (!isLoaded || !isSignedIn) return null;
      return (await getToken()) ?? null;
    });
    return () => registerClerkTokenGetter(null);
  }, [getToken, isSignedIn, isLoaded]);

  return null;
}
