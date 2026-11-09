# Local Keycloak OIDC

Configure the frontend and Convex backend to use the same Keycloak realm and
client:

```dotenv
# .env.local
VITE_OIDC_AUTHORITY=http://localhost:8080/realms/<realm>
VITE_OIDC_CLIENT_ID=<client-id>
VITE_OIDC_REDIRECT_URI=http://localhost:5173/auth/callback
VITE_CONVEX_URL=http://localhost:3210
```

In Keycloak, create a public client with Standard Flow enabled and PKCE using
`S256`. Set the client's URLs separately:

- **Valid Redirect URIs:** `http://localhost:5173/auth/callback`
- **Valid Post Logout Redirect URIs:** `http://localhost:5173`
- **Web Origins:** `http://localhost:5173`

The Keycloak ID token must contain `email` and `name`, and its `aud` claim must
include the client ID. The app passes this ID token (not the access token) to
Convex, which validates its issuer and audience. Set the matching backend
variables on the Convex deployment:

```sh
npx convex env set OIDC_AUTHORITY 'http://localhost:8080/realms/<realm>'
npx convex env set OIDC_CLIENT_ID '<client-id>'
```

The authority must exactly match the `iss` claim Keycloak puts in tokens and
must be reachable by both the browser and the Convex backend. If the Convex
backend runs in Docker, `localhost` from inside that container refers to the
container itself, not the host. Configure Keycloak's advertised hostname and
container networking so the same issuer URL is reachable from both places.
The Keycloak client secret is not used by this browser-based public client.

After changing an identity provider, existing app profiles may not be found:
the app keys a profile by the OIDC issuer and subject. Users may need to sign in
once with Keycloak and be approved again by an administrator.

# Ownership

The `OWNER_EMAILS` env var configures the owner of the application, who are irrevokable admins.