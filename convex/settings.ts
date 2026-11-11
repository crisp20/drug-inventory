import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireActiveUser, requireRole } from "./lib/access";
import { actorOf, logActivity } from "./lib/activity";
import {
  cleanExpiryWarningMonths,
  DEFAULT_EXPIRY_WARNING_MONTHS,
} from "./lib/expiry";
import {
  cleanIdleTimeoutMinutes,
  cleanLargeQuantityThreshold,
  DEFAULT_IDLE_TIMEOUT_MINUTES,
  DEFAULT_LARGE_QUANTITY_THRESHOLD,
} from "./lib/settings";
import { KeycloakClientRole } from "./lib/keycloakRoles";

// Current settings, with defaults filled in. Any approved user can read them.
export const get = query({
  args: {},
  handler: async (ctx) => {
    await requireActiveUser(ctx);
    const row = await ctx.db.query("settings").first();
    return {
      largeQuantityThreshold:
        row?.largeQuantityThreshold ?? DEFAULT_LARGE_QUANTITY_THRESHOLD,
      canisterForEveryone: row?.canisterForEveryone ?? false,
      expiryWarningMonths:
        row?.expiryWarningMonths ?? DEFAULT_EXPIRY_WARNING_MONTHS,
      idleTimeoutMinutes:
        row?.idleTimeoutMinutes ?? DEFAULT_IDLE_TIMEOUT_MINUTES,
      updatedAt: row?.updatedAt ?? null,
      updatedByName: row?.updatedByName ?? null,
    };
  },
});

// Admin: show canister features to everyone, or only to people switched on in Users
export const setCanisterRollout = mutation({
  args: { canisterForEveryone: v.boolean() },
  handler: async (ctx, { canisterForEveryone }) => {
    const admin = await requireRole(ctx, KeycloakClientRole.settings);
    const row = await ctx.db.query("settings").first();
    const before = row?.canisterForEveryone ?? false;
    if (before === canisterForEveryone) return null;
    const fields = {
      canisterForEveryone,
      updatedAt: new Date().toISOString(),
      updatedByName: admin.name ?? admin.email ?? "Unknown user",
    };
    if (row) await ctx.db.patch("settings", row._id, fields);
    else
      await ctx.db.insert("settings", {
        ...fields,
        largeQuantityThreshold: DEFAULT_LARGE_QUANTITY_THRESHOLD,
      });
    const label = (on: boolean) => (on ? "Everyone" : "Selected people only");
    await logActivity(ctx, actorOf(admin), {
      category: "settings",
      action: "Changed",
      summary: canisterForEveryone
        ? "Rolled out canister features to everyone"
        : "Limited canister features to selected people",
      changes: [
        {
          field: "Canister features",
          before: label(before),
          after: label(canisterForEveryone),
        },
      ],
    });
    return null;
  },
});

// Admin: how many months ahead canister stock counts as "expiring soon"
export const setExpiryWarning = mutation({
  args: { expiryWarningMonths: v.number() },
  handler: async (ctx, args) => {
    const admin = await requireRole(ctx, KeycloakClientRole.settings);
    const months = cleanExpiryWarningMonths(args.expiryWarningMonths);
    const row = await ctx.db.query("settings").first();
    const before = row?.expiryWarningMonths ?? DEFAULT_EXPIRY_WARNING_MONTHS;
    if (row && before === months) return null;
    const fields = {
      expiryWarningMonths: months,
      updatedAt: new Date().toISOString(),
      updatedByName: admin.name ?? admin.email ?? "Unknown user",
    };
    if (row) await ctx.db.patch("settings", row._id, fields);
    else
      await ctx.db.insert("settings", {
        ...fields,
        largeQuantityThreshold: DEFAULT_LARGE_QUANTITY_THRESHOLD,
      });
    if (before !== months) {
      const label = (m: number) => (m === 0 ? "Off" : `${m} month(s)`);
      await logActivity(ctx, actorOf(admin), {
        category: "settings",
        action: "Changed",
        summary: "Changed the expiry warning",
        changes: [
          {
            field: "Expiry warning",
            before: label(before),
            after: label(months),
          },
        ],
      });
    }
    return null;
  },
});

// Admin: after how many minutes without use the app must be refreshed (0 = off)
export const setIdleTimeout = mutation({
  args: { idleTimeoutMinutes: v.number() },
  handler: async (ctx, args) => {
    const admin = await requireRole(ctx, KeycloakClientRole.settings);
    const minutes = cleanIdleTimeoutMinutes(args.idleTimeoutMinutes);
    const row = await ctx.db.query("settings").first();
    const before = row?.idleTimeoutMinutes ?? DEFAULT_IDLE_TIMEOUT_MINUTES;
    if (before === minutes) return null;
    const fields = {
      idleTimeoutMinutes: minutes,
      updatedAt: new Date().toISOString(),
      updatedByName: admin.name ?? admin.email ?? "Unknown user",
    };
    if (row) await ctx.db.patch("settings", row._id, fields);
    else
      await ctx.db.insert("settings", {
        ...fields,
        largeQuantityThreshold: DEFAULT_LARGE_QUANTITY_THRESHOLD,
      });
    const label = (m: number) => (m === 0 ? "Off" : `${m} minute(s)`);
    await logActivity(ctx, actorOf(admin), {
      category: "settings",
      action: "Changed",
      summary: "Changed the idle refresh time",
      changes: [
        { field: "Idle refresh", before: label(before), after: label(minutes) },
      ],
    });
    return null;
  },
});

export const update = mutation({
  args: { largeQuantityThreshold: v.number() },
  handler: async (ctx, args) => {
    const admin = await requireRole(ctx, KeycloakClientRole.settings);
    const fields = {
      largeQuantityThreshold: cleanLargeQuantityThreshold(
        args.largeQuantityThreshold,
      ),
      updatedAt: new Date().toISOString(),
      updatedByName: admin.name ?? admin.email ?? "Unknown user",
    };
    const row = await ctx.db.query("settings").first();
    const before =
      row?.largeQuantityThreshold ?? DEFAULT_LARGE_QUANTITY_THRESHOLD;
    if (row) await ctx.db.patch("settings", row._id, fields);
    else await ctx.db.insert("settings", fields);
    if (before !== fields.largeQuantityThreshold) {
      await logActivity(ctx, actorOf(admin), {
        category: "settings",
        action: "Changed",
        summary: "Changed the large quantity check",
        changes: [
          {
            field: "Large quantity check",
            before: String(before),
            after: String(fields.largeQuantityThreshold),
          },
        ],
      });
    }
    return null;
  },
});
