import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, query } from "./_generated/server";
import { requireRole, RoleCatelog } from "./lib/access";
import { logMovement, logUndo } from "./lib/activity";
import { withinPeriod } from "./lib/period";
import { activityCategory } from "./schema/activity";

// Admin-only full activity log, newest first.
// Medicine, then type, use an index; the rest is filtered before paginating.
export const list = query({
  args: {
    category: v.optional(activityCategory),
    drugId: v.optional(v.id("drugs")),
    userId: v.optional(v.id("users")),
    since: v.optional(v.string()),
    until: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (
    ctx,
    { category, drugId, userId, since, until, paginationOpts },
  ) => {
    await requireRole(ctx,RoleCatelog.logs);
    const table = ctx.db.query("activityLog");
    const scoped = drugId
      ? table.withIndex("by_drug_and_occurredAt", (q) =>
          withinPeriod(q.eq("drugRef", drugId), since, until),
        )
      : category
        ? table.withIndex("by_category_and_occurredAt", (q) =>
            withinPeriod(q.eq("category", category), since, until),
          )
        : table.withIndex("by_occurredAt", (q) =>
            withinPeriod(q, since, until),
          );
    return await scoped
      .order("desc")
      .filter((q) =>
        q.and(
          userId ? q.eq(q.field("userRef"), userId) : true,
          drugId && category ? q.eq(q.field("category"), category) : true,
        ),
      )
      .paginate(paginationOpts);
  },
});

const BACKFILL_BATCH = 200;

// One-off: copies Stock In / Stock Out / Undo entries recorded before the log existed.
// Skips entries already logged, so it is safe to run again.
export const backfillMovements = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (
    ctx,
    { cursor },
  ): Promise<{ added: number; done: boolean }> => {
    const page = await ctx.db
      .query("stockMovements")
      .paginate({ numItems: BACKFILL_BATCH, cursor });
    let added = 0;
    for (const m of page.page) {
      const logged = await ctx.db
        .query("activityLog")
        .withIndex("by_movement", (q) => q.eq("movementRef", m._id))
        .take(2);
      if (!logged.some((e) => e.category !== "undo")) {
        await logMovement(ctx, m);
        added++;
      }
      if (m.undo && !logged.some((e) => e.category === "undo")) {
        await logUndo(ctx, m);
        added++;
      }
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.activity.backfillMovements, {
        cursor: page.continueCursor,
      });
    }
    return { added, done: page.isDone };
  },
});
