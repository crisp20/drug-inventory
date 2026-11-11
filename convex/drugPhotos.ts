import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireRole } from "./lib/access";
import { SYSTEM_ACTOR, actorOf, logActivity, type Actor } from "./lib/activity";
import { deleteFiles } from "./lib/drugs";
import { MAX_PHOTO_BATCH, MAX_PHOTO_CHECK } from "./lib/drugPhotos";
import { KeycloakClientRole } from "./lib/keycloakRoles";

const photoItem = v.object({ drugId: v.string(), storageId: v.id("_storage") });

async function findDrug(ctx: MutationCtx, drugId: string) {
  return await ctx.db
    .query("drugs")
    .withIndex("by_drugId", (q) => q.eq("drugId", drugId.trim()))
    .first();
}

// Sets each drug's main picture, replacing (and deleting) the old one.
// Uploads for unknown Drug IDs are deleted so no orphan files are left behind.
async function applyPhotos(
  ctx: MutationCtx,
  items: { drugId: string; storageId: Id<"_storage"> }[],
  actor: Actor,
) {
  let applied = 0;
  const notFound: string[] = [];
  for (const { drugId, storageId } of items) {
    const drug = await findDrug(ctx, drugId);
    if (!drug) {
      notFound.push(drugId);
      await deleteFiles(ctx, [storageId]);
      continue;
    }
    if (drug.imageId && drug.imageId !== storageId) await deleteFiles(ctx, [drug.imageId]);
    await ctx.db.patch("drugs", drug._id, { imageId: storageId, updatedAt: new Date().toISOString() });
    const action = drug.imageId ? "Replaced" : "Added";
    await logActivity(ctx, actor, {
      category: "photo",
      action,
      summary: `${action} medicine picture (photo upload)`,
      drug,
    });
    applied += 1;
  }
  return { applied, notFound };
}

// Tells the upload screen which Drug IDs exist and which already have a picture
export const checkPhotos = query({
  args: { drugIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    await requireRole(ctx, KeycloakClientRole.inventory_manage);
    if (args.drugIds.length > MAX_PHOTO_CHECK) {
      throw new ConvexError({ code: "BAD_REQUEST", message: `Check at most ${MAX_PHOTO_CHECK} photos at a time` });
    }
    return await Promise.all(
      args.drugIds.map(async (drugId) => {
        const drug = await ctx.db
          .query("drugs")
          .withIndex("by_drugId", (q) => q.eq("drugId", drugId.trim()))
          .first();
        return drug
          ? {
              drugId,
              found: true as const,
              name: drug.name,
              hasPhoto: !!drug.imageId,
              // Current picture, so the admin can compare it with the new one
              photoUrl: drug.imageId ? await ctx.storage.getUrl(drug.imageId) : null,
            }
          : { drugId, found: false as const, name: "", hasPhoto: false, photoUrl: null };
      }),
    );
  },
});

export const setPhotos = mutation({
  args: { items: v.array(photoItem) },
  handler: async (ctx, args) => {
    const admin = await requireRole(ctx, KeycloakClientRole.inventory_manage);
    if (args.items.length > MAX_PHOTO_BATCH) {
      throw new ConvexError({ code: "BAD_REQUEST", message: `Send at most ${MAX_PHOTO_BATCH} photos at a time` });
    }
    return await applyPhotos(ctx, args.items, actorOf(admin));
  },
});

// One-off loads run by the builder
export const setPhotosInternal = internalMutation({
  args: { items: v.array(photoItem) },
  handler: async (ctx, args) => await applyPhotos(ctx, args.items, SYSTEM_ACTOR),
});
