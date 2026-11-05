import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    DIRECTOR_USERNAME: v.string(),
    DIRECTOR_PASSWORD: v.string(),
  },
});

export default app;
