import { Show, SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/react";

export default function AccountBar() {
  if (!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) return null;
  return <AccountControls />;
}

function AccountControls() {
  const { isLoaded } = useAuth();
  if (!isLoaded) return null;

  return (
    <div className="account-bar">
      <Show when="signed-out">
        <div className="account-bar__signed-out">
          <div className="account-bar__buttons">
            <SignInButton mode="modal">
              <button type="button" className="account-bar__btn">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button type="button" className="account-bar__btn account-bar__btn--primary">
                Sign up
              </button>
            </SignUpButton>
          </div>
          <p className="account-bar__hint">
            Your book notes only last for this visit. Sign in to keep them.
          </p>
        </div>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </div>
  );
}
