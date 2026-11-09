import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  getSignedInUser,
  isOwnerEmail,
  requireActiveUser,
  requireAdmin,
} from "./lib/access";
import { actorOf, displayName, logActivity } from "./lib/activity";
import {
  isValidInitials,
  MAX_INITIALS_LENGTH,
  normalizeInitials,
} from "./lib/initials";
import { userRole, userStatus } from "./schema/users";

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
    const isOwner = isOwnerEmail(identity.email);

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (user !== null) {
      if (isOwner && (user.role !== "admin" || user.status !== "active")) {
        await ctx.db.patch("users", user._id, {
          role: "admin",
          status: "active",
        });
      } else if (!user.status || !user.role) {
        await ctx.db.patch("users", user._id, {
          role: user.role ?? "staff",
          status: user.status ?? "pending",
        });
      }
      return user._id;
    }
    // New people wait for admin approval, except the owner
    const userId = await ctx.db.insert("users", {
      name: identity.name,
      email: identity.email,
      tokenIdentifier: identity.tokenIdentifier,
      role: isOwner ? "admin" : "staff",
      status: isOwner ? "active" : "pending",
    });
    const name = identity.name ?? identity.email ?? "Unknown user";
    await logActivity(
      ctx,
      { userRef: userId, userName: name },
      {
        category: "user",
        action: "Signed up",
        summary: `${name} signed up${isOwner ? "" : " (waiting for approval)"}`,
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

export const listByStatus = query({
  args: { status: userStatus },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("users")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .take(200);
  },
});

// Names of everyone who can have recorded entries (for "filter by user")
export const listPeople = query({
  args: {},
  handler: async (ctx) => {
    await requireActiveUser(ctx);
    const [active, disabled] = await Promise.all(
      (["active", "disabled"] as const).map((status) =>
        ctx.db
          .query("users")
          .withIndex("by_status", (q) => q.eq("status", status))
          .take(200),
      ),
    );
    return [...active, ...disabled]
      .map((u) => ({ _id: u._id, name: u.name ?? u.email ?? "Unknown user" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const updateAccess = mutation({
  args: { userId: v.id("users"), role: userRole, status: userStatus },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const target = await ctx.db.get("users", args.userId);
    if (!target) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }
    if (isOwnerEmail(target.email)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "The owner account cannot be changed",
      });
    }
    if (target._id === admin._id) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "You cannot change your own access",
      });
    }
    await ctx.db.patch("users", args.userId, {
      role: args.role,
      status: args.status,
    });
    const changes = [
      { field: "Role", before: target.role ?? "staff", after: args.role },
      {
        field: "Status",
        before: target.status ?? "pending",
        after: args.status,
      },
    ].filter((c) => c.before !== c.after);
    if (changes.length > 0) {
      const approved = target.status === "pending" && args.status === "active";
      const action = approved
        ? "Approved"
        : args.status === "disabled" && target.status !== "disabled"
          ? "Disabled"
          : "Access changed";
      await logActivity(ctx, actorOf(admin), {
        category: "user",
        action,
        summary: `${action}: ${displayName(target)}`,
        detail: target.email,
        changes,
      });
    }
    return null;
  },
});

// Admin: initials printed on this person's labels ("" goes back to the name's initials)
export const setInitials = mutation({
  args: { userId: v.id("users"), initials: v.string() },
  handler: async (ctx, { userId, initials }) => {
    const admin = await requireAdmin(ctx);
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
    const admin = await requireAdmin(ctx);
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
