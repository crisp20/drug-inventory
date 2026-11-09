import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useAuth } from "@/hooks/use-auth.ts";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  authCallbackMessages,
  type AuthCallbackMessages,
} from "./callback-messages.ts";
import { resolveReturnTo } from "./return-to.ts";

interface AuthCallbackProps {
  messages?: AuthCallbackMessages;
}

export default function AuthCallback({
  messages: {
    loading = authCallbackMessages.en.loading,
    errorTitle = authCallbackMessages.en.errorTitle,
    missingState = authCallbackMessages.en.missingState,
    returnHome = authCallbackMessages.en.returnHome,
    tryAgain = authCallbackMessages.en.tryAgain,
  } = {},
}: AuthCallbackProps): React.JSX.Element {
  const navigate = useNavigate();
  const auth = useAuth();
  const convexAuth = useConvexAuth();
  const updateCurrentUser = useMutation(api.users.updateCurrentUser);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncStarted = useRef(false);

  const navigateHome = useCallback(
    () => navigate("/", { replace: true }),
    [navigate],
  );
  const returnTo = resolveReturnTo(auth.user?.state);
  const navigateBack = useCallback(
    () => navigate(returnTo, { replace: true }),
    [navigate, returnTo],
  );

  useEffect(() => {
    if (
      auth.isLoading ||
      !auth.isAuthenticated ||
      !convexAuth.isLoading
    ) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setSyncError(
        "Convex is still verifying your Keycloak token. Check its connection and the configured OIDC issuer and client audience.",
      );
    }, 20_000);
    return () => window.clearTimeout(timeout);
  }, [
    auth.isAuthenticated,
    auth.isLoading,
    convexAuth.isLoading,
  ]);

  useEffect(() => {
    if (auth.isLoading || auth.error) return;
    if (!auth.isAuthenticated) {
      navigateHome();
      return;
    }
    if (convexAuth.isLoading) return;
    if (!convexAuth.isAuthenticated) {
      return;
    }
    if (syncStarted.current) return;
    syncStarted.current = true;
    void updateCurrentUser()
      .then(navigateBack)
      .catch((error: unknown) => {
        syncStarted.current = false;
        setSyncError(
          error instanceof Error
            ? error.message
            : "Could not finish signing in",
        );
      });
  }, [
    auth.error,
    auth.isAuthenticated,
    auth.isLoading,
    convexAuth.isAuthenticated,
    convexAuth.isLoading,
    navigateBack,
    navigateHome,
    updateCurrentUser,
  ]);

  const error =
    auth.error?.message ??
    syncError ??
    (auth.isAuthenticated &&
    !convexAuth.isLoading &&
    !convexAuth.isAuthenticated
      ? "Convex could not verify your Keycloak sign-in. Check the configured OIDC issuer and client audience."
      : null);
  const retry = () => {
    setSyncError(null);
    void auth.signin(returnTo).catch((signinError: unknown) => {
      setSyncError(
        signinError instanceof Error
          ? signinError.message
          : "Could not restart sign-in",
      );
    });
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-svh gap-6 px-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-destructive font-medium">{errorTitle}</p>
          <p className="text-sm text-muted-foreground max-w-md">
            {error === "No matching state found in storage"
              ? missingState
              : error}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={navigateHome}>
            {returnHome}
          </Button>
          <Button onClick={retry}>{tryAgain}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-svh gap-4">
      <Spinner className="size-8" aria-label={loading} />
      <p className="text-sm text-muted-foreground">{loading}</p>
    </div>
  );
}
