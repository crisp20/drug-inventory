import { AuthConfig } from "convex/server";
import { env } from "./_generated/server";

export default {
  providers: [
    {
      domain: env.OIDC_AUTHORITY,
      applicationID: env.OIDC_CLIENT_ID,
    },
  ],
} satisfies AuthConfig;
