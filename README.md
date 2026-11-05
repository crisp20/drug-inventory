# Drug Inventory

Drug inventory management with Convex-backed drug records, stock operations,
and activity history. Authentication and app data currently use the local
Convex backend; the remote backend integration can be added later.

## Local development

Start the self-hosted Convex backend and dashboard:

```sh
docker compose up -d
```

Push the schema and functions:

```sh
npm install
npm exec -- convex dev --url http://localhost:3210 --admin-key "<ADMIN_KEY>"
```

## Configure authentication

Generate Convex Auth signing keys and set the frontend URL on the backend:

```sh
npm exec -- auth --url http://localhost:3210 --admin-key "<ADMIN_KEY>" --web-server-url http://localhost:5173
```

The auth setup command creates `convex/http.ts` locally, but does not deploy
that file. After running it, make sure the Convex dev process has synced the
new file. If it was already running, restart the command from the previous
step:

```sh
npm exec -- convex dev --url http://localhost:3210 --admin-key "<ADMIN_KEY>"
```

Wait for the Convex dev process to report that it deployed successfully. You
can verify Auth's discovery endpoint is enabled with:

```sh
curl http://localhost:3211/.well-known/openid-configuration
```

It should return JSON, not `This Convex deployment does not have HTTP actions
enabled.` The frontend's `VITE_CONVEX_URL` should point to the matching
backend at `http://localhost:3210`.

The command stores `SITE_URL`, `JWT_PRIVATE_KEY`, and `JWKS` on the selected
Convex deployment; it does not add them to a local `.env` file. If it reports
that either signing key already exists, choose to overwrite both if setup was
incomplete. Otherwise the command can finish while leaving a missing key.
Confirm the deployment has both `JWT_PRIVATE_KEY` and `JWKS` in the dashboard's
environment variables before signing in. The app's `VITE_CONVEX_URL` must point
to that same backend.

In the Convex dashboard, configure these server-side environment variables:

| Variable            | Value                                                                     |
| ------------------- | ------------------------------------------------------------------------- |
| `DIRECTOR_USERNAME` | Director username in email format                                         |
| `DIRECTOR_PASSWORD` | 12-20 characters with uppercase, lowercase, special, and digit characters |

Create the Director account in the app using the configured username and exact
password. That account is activated automatically; all other sign-ups remain
pending until the Director approves them on the Users page. Passwords are
stored as hashes after registration. Changing `DIRECTOR_PASSWORD` later does
not reset the account password.

All new and reset passwords must be 12-20 characters long and include at least
one uppercase letter, one lowercase letter, one special character, and one
digit.

Existing profiles are matched by username when an account is first created.
Former admin access is not carried over; only the configured Director is
automatically active.

The login flow does not send email, verify email addresses, or provide password
recovery. Usernames are email-shaped only. Set `VITE_CONVEX_URL` if the
frontend should connect to a different Convex backend.

Run the frontend in a second terminal:

```sh
npm run dev
```
