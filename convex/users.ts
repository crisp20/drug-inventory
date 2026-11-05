import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { requireActiveUser, requireAdmin } from "./lib/access";
import { actorOf, displayName, logActivity } from "./lib/activity";
import { userStatus } from "./schema/users";

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    return userId ? await ctx.db.get("users", userId) : null;
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
  args: { userId: v.id("users"), status: userStatus },
  handler: async (ctx, args) => {
    const director = await requireAdmin(ctx);
    const target = await ctx.db.get("users", args.userId);
    if (!target) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }
    if (target.role === "director") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "The director account cannot be changed",
      });
    }
    if (target._id === director._id) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "You cannot change your own access",
      });
    }
    await ctx.db.patch("users", args.userId, {
      status: args.status,
    });
    const changes = [
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
      await logActivity(ctx, actorOf(director), {
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
