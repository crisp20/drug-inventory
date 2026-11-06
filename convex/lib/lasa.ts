import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

// "Look Alike, Sound Alike" links between drugs. Each link is stored both ways.
export const MAX_LASA_LINKS = 20;

export type LookAlike = Pick<Doc<"drugs">, "_id" | "drugId" | "name" | "brandName"> & {
  imageUrl: string | null;
};

async function linkRows(ctx: QueryCtx, drugRef: Id<"drugs">) {
  return await ctx.db
    .query("lasaLinks")
    .withIndex("by_drugRef_and_otherRef", (q) => q.eq("drugRef", drugRef))
    .take(MAX_LASA_LINKS * 2);
}

// The drugs linked to this one, with just enough to name them
export async function getLookAlikes(ctx: QueryCtx, drugRef: Id<"drugs">): Promise<LookAlike[]> {
  const rows = await linkRows(ctx, drugRef);
  const drugs = await Promise.all(rows.map((r) => ctx.db.get("drugs", r.otherRef)));
  const found = drugs.filter((d): d is Doc<"drugs"> => d !== null);
  const withImages = await Promise.all(
    found.map(async (d) => ({
      _id: d._id,
      drugId: d.drugId,
      name: d.name,
      brandName: d.brandName,
      imageUrl: d.imageId ? await ctx.storage.getUrl(d.imageId) : null,
    })),
  );
  return withImages.sort((a, b) => a.name.localeCompare(b.name));
}

async function findLink(ctx: QueryCtx, drugRef: Id<"drugs">, otherRef: Id<"drugs">) {
  return await ctx.db
    .query("lasaLinks")
    .withIndex("by_drugRef_and_otherRef", (q) => q.eq("drugRef", drugRef).eq("otherRef", otherRef))
    .first();
}

async function unlink(ctx: MutationCtx, a: Id<"drugs">, b: Id<"drugs">) {
  for (const [x, y] of [[a, b], [b, a]] as const) {
    const row = await findLink(ctx, x, y);
    if (row) await ctx.db.delete("lasaLinks", row._id);
  }
}

async function link(ctx: MutationCtx, a: Id<"drugs">, b: Id<"drugs">) {
  for (const [x, y] of [[a, b], [b, a]] as const) {
    if (!(await findLink(ctx, x, y))) await ctx.db.insert("lasaLinks", { drugRef: x, otherRef: y });
  }
  // A drug that something looks like is itself a look-alike
  const other = await ctx.db.get("drugs", b);
  if (other && !other.lasa) await ctx.db.patch("drugs", b, { lasa: true });
}

// Replaces this drug's links. Returns the names added and removed (for the activity log).
export async function setLookAlikes(
  ctx: MutationCtx,
  drugRef: Id<"drugs">,
  wanted: Id<"drugs">[],
): Promise<{ before: string[]; after: string[] }> {
  const unique = [...new Set(wanted)].filter((id) => id !== drugRef);
  if (unique.length > MAX_LASA_LINKS) {
    throw new ConvexError({ code: "BAD_REQUEST", message: `Link up to ${MAX_LASA_LINKS} look-alike drugs` });
  }
  for (const id of unique) {
    if (!(await ctx.db.get("drugs", id))) {
      throw new ConvexError({ code: "NOT_FOUND", message: "A linked look-alike drug no longer exists" });
    }
  }
  const current = await getLookAlikes(ctx, drugRef);
  const currentIds = new Set(current.map((d) => d._id));
  const wantedIds = new Set(unique);
  for (const d of current) if (!wantedIds.has(d._id)) await unlink(ctx, drugRef, d._id);
  for (const id of unique) if (!currentIds.has(id)) await link(ctx, drugRef, id);
  const after = await getLookAlikes(ctx, drugRef);
  return { before: current.map(label), after: after.map(label) };
}

function label(d: LookAlike) {
  return `${d.name} (${d.drugId})`;
}

// Drops every link to and from a drug (when it is unmarked or deleted)
export async function clearLookAlikes(ctx: MutationCtx, drugRef: Id<"drugs">) {
  for (const row of await linkRows(ctx, drugRef)) await unlink(ctx, drugRef, row.otherRef);
}
