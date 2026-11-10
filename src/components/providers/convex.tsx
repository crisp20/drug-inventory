import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import {
  ConvexProviderWithAuth,
  ConvexReactClient,
} from "convex/react";
import { useAuth as useOidcAuth } from "react-oidc-context";

const convexUrl = import.meta.env.VITE_CONVEX_URL ?? "http://localhost:3210";
const convex = new ConvexReactClient(convexUrl);

function useOidcConvexAuth() {
  const { isLoading, isAuthenticated, user, signinSilent } = useOidcAuth();
  const userRef = useRef(user);
  const signinSilentRef = useRef(signinSilent);
  useLayoutEffect(() => {
    userRef.current = user;
    signinSilentRef.current = signinSilent;
  }, [signinSilent, user]);

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      if (forceRefreshToken) {
        const refreshedUser = await signinSilentRef.current();
        return refreshedUser?.id_token ?? null;
      }
      return userRef.current?.id_token ?? null;
    },
    [],
  );

  return useMemo(
    () => ({
      isLoading: isLoading && !isAuthenticated,
      isAuthenticated,
      fetchAccessToken,
    }),
    [isLoading, isAuthenticated, fetchAccessToken],
  );
}

export function ConvexProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useOidcConvexAuth}>
      {children}
    </ConvexProviderWithAuth>
  );
}
