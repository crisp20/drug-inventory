# Local Keycloak OIDC

Configure the frontend and Convex backend to use the same Keycloak realm and
client:

```dotenv
# .env.local
VITE_OIDC_AUTHORITY=http://localhost:8080/realms/<realm>
VITE_OIDC_CLIENT_ID=<client-id>
VITE_OIDC_REDIRECT_URI=http://localhost:5273/auth/callback
VITE_CONVEX_URL=http://localhost:3210
```

In Keycloak, create a public client with Standard Flow enabled and PKCE using
`S256`. Set the client's URLs separately:

- **Valid Redirect URIs:** `http://localhost:5273/auth/callback`
- **Valid Post Logout Redirect URIs:** `http://localhost:5273`
- **Web Origins:** `http://localhost:5273`

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
once with Keycloak to create a new profile.

# Keycloak access and roles

Assign the Keycloak client roles `access` to users through Keycloak
groups. The ID token must include the `drug_inventory_roles` claim or the
standard Keycloak `resource_access.drug-inventory.roles` claim. Users need
`access` to use the application.

For greater privileges, assign the roles `changes`, `logs`, `settings`, `users`, or `inventory_manage` to gain certain rights. Alternatively, assign the `admin` role to gain all of the aforementioned roles.

The Users page does not grant application roles. Assign or remove roles in
Keycloak; changes take effect after the user's token is refreshed. User profile
records retain optional legacy role/status fields for existing database rows,
but those fields no longer control authorization.
