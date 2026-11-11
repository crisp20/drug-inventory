import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    OIDC_AUTHORITY: v.string(),
    OIDC_CLIENT_ID: v.string(),
    KC_BACKEND_CLIENT_SECRET: v.string(),
    KC_DRUG_INVENTORY_CLIENT_UUID: v.string(),
  },
});

export default app;
