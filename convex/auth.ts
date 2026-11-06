import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Value } from "convex/values";
import type { DataModel, Id } from "./_generated/dataModel";
import { env, type MutationCtx } from "./_generated/server";
import { logActivity } from "./lib/activity";
import { validatePasswordRequirements } from "./lib/password";
import { isValidUsername } from "./lib/username";

const USER_LIMIT = 500;

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function isString(value: Value | undefined): value is string {
  return typeof value === "string";
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password<DataModel>({
      validatePasswordRequirements,
      profile(params) {
        if (!isString(params.email)) {
          throw new Error("Enter a username in email format");
        }
        const email = normalizeUsername(params.email);
        if (!isValidUsername(email)) {
          throw new Error("Enter a valid username in email format");
        }

        const isSignUp = params.flow === "signUp";
        if (
          isSignUp &&
          (typeof params.confirmPassword !== "string" ||
            params.confirmPassword !== params.password)
        ) {
          throw new Error("Passwords do not match");
        }
        const adminUsername = env.DIRECTOR_USERNAME
          ? normalizeUsername(env.DIRECTOR_USERNAME)
          : undefined;
        const adminPassword = env.DIRECTOR_PASSWORD;
        const isAdmin = isSignUp && email === adminUsername;

        if (
          isSignUp &&
          (!adminUsername ||
            !isValidUsername(adminUsername) ||
            !adminPassword)
        ) {
          throw new Error("Admin account setup is not configured");
        }
        if (
          isAdmin &&
          (typeof params.password !== "string" ||
            params.password !== adminPassword)
        ) {
          throw new Error("Invalid admin credentials");
        }

        const name = isString(params.name) ? params.name.trim() : "";
        if (name.length > 80) {
          throw new Error("Name is too long");
        }
        return {
          email,
          name: name || email,
          role: isAdmin ? "admin" : "staff",
          status: isAdmin ? "active" : "pending",
        };
      },
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx, { existingUserId, profile }) {
      if (existingUserId) return existingUserId;
      const appCtx = ctx as MutationCtx;

      const email =
        typeof profile.email === "string"
          ? normalizeUsername(profile.email)
          : undefined;
      if (!email || !isValidUsername(email)) {
        throw new ConvexError("Enter a valid username in email format");
      }

      const users = await appCtx.db.query("users").take(USER_LIMIT);
      const matchingUsers = users.filter(
        (user) =>
          typeof user.email === "string" &&
          normalizeUsername(user.email) === email,
      );
      if (users.length === USER_LIMIT && matchingUsers.length === 0) {
        throw new ConvexError(
          "The user directory is at capacity; resolve existing users before registering",
        );
      }
      if (matchingUsers.length > 1) {
        throw new ConvexError(
          "Multiple existing users have this username; resolve duplicate records before registering",
        );
      }

      const isAdmin = profile.role === "admin";
      const name =
        typeof profile.name === "string" && profile.name.trim()
          ? profile.name.trim()
          : email;
      const role = isAdmin ? "admin" : "staff";
      const status = isAdmin ? "active" : "pending";

      let userId: Id<"users">;
      if (matchingUsers[0]) {
        await appCtx.db.patch("users", matchingUsers[0]._id, {
          email,
          name,
          role,
          status,
        });
        userId = matchingUsers[0]._id;
      } else {
        userId = await appCtx.db.insert("users", {
          email,
          name,
          role,
          status,
        });
      }

      await logActivity(
        appCtx,
        { userRef: userId, userName: name },
        {
          category: "user",
          action: "Signed up",
          summary: `${name} signed up${isAdmin ? "" : " (waiting for approval)"}`,
          detail: email,
        },
      );
      return userId;
    },
  },
});
