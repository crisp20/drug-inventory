import { AuthProvider as OidcAuthProvider } from "react-oidc-context";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const authority = import.meta.env.VITE_OIDC_AUTHORITY;
  const clientId = import.meta.env.VITE_OIDC_CLIENT_ID;
  if (!authority || !clientId) {
    throw new Error(
      "Set VITE_OIDC_AUTHORITY and VITE_OIDC_CLIENT_ID to configure OIDC login",
    );
  }

  const origin = window.location.origin;
  return (
    <OidcAuthProvider
      authority={authority}
      client_id={clientId}
      redirect_uri={
        import.meta.env.VITE_OIDC_REDIRECT_URI ??
        `${origin}/auth/callback`
      }
      post_logout_redirect_uri={origin}
      response_type="code"
      scope={import.meta.env.VITE_OIDC_SCOPE ?? "openid profile email"}
      automaticSilentRenew
      requestTimeoutInSeconds={30}
      onSigninCallback={() => {
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );
      }}
    >
      {children}
    </OidcAuthProvider>
  );
}
