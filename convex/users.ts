import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getSignedInUser, requireActiveUser, requireRole } from "./lib/access";
import { actorOf, displayName, logActivity } from "./lib/activity";
import {
  isValidInitials,
  MAX_INITIALS_LENGTH,
  normalizeInitials,
} from "./lib/initials";
import { KeycloakClientRole } from "./lib/keycloakRoles";

export const updateCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (user !== null) return user._id;

    const userId = await ctx.db.insert("users", {
      name: identity.name,
      email: identity.email,
      tokenIdentifier: identity.tokenIdentifier,
    });
    const name = identity.name ?? identity.email ?? "Unknown user";
    await logActivity(
      ctx,
      { userRef: userId, userName: name },
      {
        category: "user",
        action: "Signed up",
        summary: `${name} signed in`,
        detail: identity.email,
      },
    );
    return userId;
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return await getSignedInUser(ctx);
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, KeycloakClientRole.users);
    return await ctx.db
      .query("users")
      .take(200)
      .then((users) =>
        users.sort((a, b) =>
          (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? ""),
        ),
      );
  },
});

// Names of everyone who can have recorded entries (for "filter by user")
export const listPeople = query({
  args: {},
  handler: async (ctx) => {
    await requireActiveUser(ctx);
    return (await ctx.db.query("users").take(200))
      .map((u) => ({ _id: u._id, name: u.name ?? u.email ?? "Unknown user" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

// Admin: initials printed on this person's labels ("" goes back to the name's initials)
export const setInitials = mutation({
  args: { userId: v.id("users"), initials: v.string() },
  handler: async (ctx, { userId, initials }) => {
    const admin = await requireRole(ctx, KeycloakClientRole.users);
    const target = await ctx.db.get("users", userId);
    if (!target) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }
    const next = normalizeInitials(initials);
    if (next !== "" && !isValidInitials(next)) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: `Initials must be 1 to ${MAX_INITIALS_LENGTH} letters or numbers`,
      });
    }
    const before = target.initials ?? "";
    if (before === next) return null;
    await ctx.db.patch("users", userId, { initials: next || undefined });
    await logActivity(ctx, actorOf(admin), {
      category: "user",
      action: "Access changed",
      summary: `Changed label initials for ${displayName(target)}`,
      detail: target.email,
      changes: [
        {
          field: "Label initials",
          before: before || "(from name)",
          after: next || "(from name)",
        },
      ],
    });
    return null;
  },
});

// Admin: early access to canister features for one person
export const setCanisterAccess = mutation({
  args: { userId: v.id("users"), enabled: v.boolean() },
  handler: async (ctx, { userId, enabled }) => {
    const admin = await requireRole(ctx, KeycloakClientRole.users);
    const target = await ctx.db.get("users", userId);
    if (!target) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }
    const before = target.canisterAccess === true;
    if (before === enabled) return null;
    await ctx.db.patch("users", userId, { canisterAccess: enabled });
    await logActivity(ctx, actorOf(admin), {
      category: "user",
      action: "Access changed",
      summary: `${enabled ? "Turned on" : "Turned off"} canister features for ${displayName(target)}`,
      detail: target.email,
      changes: [
        {
          field: "Canister features",
          before: before ? "On" : "Off",
          after: enabled ? "On" : "Off",
        },
      ],
    });
    return null;
  },
});
