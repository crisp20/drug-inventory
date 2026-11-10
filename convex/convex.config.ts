import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    OIDC_AUTHORITY: v.string(),
    OIDC_CLIENT_ID: v.string(),
  },
});

export default app;
