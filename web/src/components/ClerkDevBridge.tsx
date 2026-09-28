import { useEffect } from "react";
import { useAuth } from "@clerk/react";

/* Dev-only: expose token/user id on window so we can confirm Clerk works
   without wiring the backend yet. */
export default function ClerkDevBridge() {
  if (!import.meta.env.DEV || !import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) {
    return null;
  }
  return <ClerkDevBridgeInner />;
}

function ClerkDevBridgeInner() {
  const { getToken, userId, isSignedIn } = useAuth();

  useEffect(() => {
    Object.assign(window, {
      getClerkToken: () => getToken(),
      getClerkUserId: () => userId ?? null,
      isClerkSignedIn: () => Boolean(isSignedIn),
    });
  }, [getToken, userId, isSignedIn]);

  return null;
}
