import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    OIDC_AUTHORITY: v.string(),
    OIDC_CLIENT_ID: v.string(),
    // Comma-separated emails that are always active admins (e.g. "a@x.com, b@x.com")
    OWNER_EMAILS: v.optional(v.string()),
  },
});

export default app;
