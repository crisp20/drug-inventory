import { useCallback } from "react";
import { useAuth as useOidcAuth } from "react-oidc-context";

export function useAuth() {
  const auth = useOidcAuth();
  const signinRedirect = auth.signinRedirect;
  const signoutRedirect = auth.signoutRedirect;
  const signin = useCallback(
    (returnTo = "/") =>
      signinRedirect({
        state: { returnTo },
      }),
    [signinRedirect],
  );
  const signout = useCallback(
    () => signoutRedirect(),
    [signoutRedirect],
  );

  return {
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    error: auth.error,
    user: auth.user,
    signin,
    signout,
  };
}
