import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { formatPackageForm } from "./barcode";
import {
  formatBatchExpiry,
  formatCanister,
  formatMismatchedScan,
} from "./canister";
import type { PackageInput } from "./drugs";

// Filter / badge labels for each kind of activity (matches schema/activity.ts)
export const ACTIVITY_CATEGORIES = [
  { value: "medicine", label: "Medicines" },
  { value: "package", label: "Package forms" },
  { value: "photo", label: "Pictures" },
  { value: "import", label: "Imports" },
  { value: "stock_in", label: "Stock In" },
  { value: "stock_out", label: "Stock Out" },
  { value: "undo", label: "Undos" },
  { value: "user", label: "Users" },
  { value: "settings", label: "Settings" },
] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number]["value"];

export const MAX_CHANGES = 40;

export type Change = { field: string; before: string; after: string };
export type Actor = { userRef?: Id<"users">; userName: string };

export const SYSTEM_ACTOR: Actor = { userName: "System" };

export function displayName(u: Pick<Doc<"users">, "name" | "email">): string {
  return u.name ?? u.email ?? "Unknown user";
}

export function actorOf(user: Doc<"users">): Actor {
  return { userRef: user._id, userName: displayName(user) };
}

type Entry = {
  category: ActivityCategory;
  action: string;
  summary: string;
  drug?: Pick<Doc<"drugs">, "_id" | "drugId" | "name">;
  detail?: string;
  changes?: Change[];
  movementRef?: Id<"stockMovements">;
  occurredAt?: string;
};

export async function logActivity(ctx: MutationCtx, actor: Actor, e: Entry) {
  await ctx.db.insert("activityLog", {
    category: e.category,
    action: e.action,
    summary: e.summary,
    drugRef: e.drug?._id,
    drugCode: e.drug?.drugId,
    drugName: e.drug?.name,
    detail: e.detail || undefined,
    changes:
      e.changes && e.changes.length > 0
        ? e.changes.slice(0, MAX_CHANGES)
        : undefined,
    movementRef: e.movementRef,
    userRef: actor.userRef,
    userName: actor.userName,
    occurredAt: e.occurredAt ?? new Date().toISOString(),
  });
}

// ---------- Medicine diffs ----------

type DrugFields = Pick<
  Doc<"drugs">,
  "drugId" | "name" | "brandName" | "manufacturer" | "pieceName"
>;

const DRUG_FIELDS: ReadonlyArray<[keyof DrugFields, string]> = [
  ["drugId", "Drug ID"],
  ["name", "Name"],
  ["brandName", "Brand"],
  ["manufacturer", "Manufacturer"],
  ["pieceName", "Piece name"],
];

// Fields that differ; `before` null means a new medicine (every filled field)
export function diffDrugFields(
  before: DrugFields | null,
  after: DrugFields,
): Change[] {
  const changes: Change[] = [];
  for (const [key, label] of DRUG_FIELDS) {
    const old = before ? before[key] : "";
    if (old !== after[key]) {
      changes.push({ field: label, before: old, after: after[key] });
    }
  }
  return changes;
}

type PackageLike = Pick<
  PackageInput,
  "barcode" | "qtyPerUnit" | "baseUnit" | "unitCount"
>;

export function packageLabel(p: PackageLike): string {
  return `${formatPackageForm(p)} · ${p.barcode || "No barcode"}`;
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

type SavedPackage = Pick<
  Doc<"drugPackages">,
  | "_id"
  | "barcode"
  | "qtyPerUnit"
  | "baseUnit"
  | "unitCount"
  | "stock"
  | "imageIds"
>;

function diffPackage(before: SavedPackage, after: PackageInput): Change[] {
  const changes: Change[] = [];
  if (before.barcode !== after.barcode) {
    changes.push({
      field: "Barcode",
      before: before.barcode || "No barcode",
      after: after.barcode || "No barcode",
    });
  }
  const oldForm = formatPackageForm(before);
  const newForm = formatPackageForm(after);
  if (oldForm !== newForm) {
    changes.push({ field: "Package form", before: oldForm, after: newForm });
  }
  if (before.stock !== after.stock) {
    changes.push({
      field: "Stock",
      before: String(before.stock),
      after: String(after.stock),
    });
  }
  return changes;
}

function countNew(ids: Id<"_storage">[], than: Id<"_storage">[]) {
  const set = new Set(than);
  return ids.filter((id) => !set.has(id)).length;
}

function pictureDetail(added: number, removed: number) {
  return [
    added > 0 ? `${plural(added, "picture")} added` : "",
    removed > 0 ? `${plural(removed, "picture")} removed` : "",
  ]
    .filter(Boolean)
    .join(", ");
}

type DrugSave = {
  drug: Pick<Doc<"drugs">, "_id" | "drugId" | "name">;
  before: (DrugFields & { imageId?: Id<"_storage"> }) | null;
  beforePackages: SavedPackage[];
  after: DrugFields & { imageId?: Id<"_storage"> };
  afterPackages: PackageInput[];
};

// Activity entries for a medicine saved from the Inventory form
export async function logDrugSave(ctx: MutationCtx, actor: Actor, s: DrugSave) {
  const { drug, before, after } = s;
  if (!before) {
    await logActivity(ctx, actor, {
      category: "medicine",
      action: "Added",
      summary: `Added ${after.name}`,
      drug,
      detail: `${plural(s.afterPackages.length, "package form")}: ${s.afterPackages
        .map((p) => `${packageLabel(p)} (stock ${p.stock})`)
        .join("; ")}`,
      changes: diffDrugFields(null, after),
    });
    return;
  }

  const fieldChanges = diffDrugFields(before, after);
  if (fieldChanges.length > 0) {
    await logActivity(ctx, actor, {
      category: "medicine",
      action: "Edited",
      summary: `Edited ${after.name}`,
      drug,
      changes: fieldChanges,
    });
  }

  if (before.imageId !== after.imageId) {
    const action = !after.imageId
      ? "Removed"
      : before.imageId
        ? "Replaced"
        : "Added";
    await logActivity(ctx, actor, {
      category: "photo",
      action,
      summary: `${action} medicine picture`,
      drug,
    });
  }

  const byId = new Map(s.beforePackages.map((p) => [p._id, p]));
  const kept = new Set<Id<"drugPackages">>();
  for (const p of s.afterPackages) {
    const old = p.packageId ? byId.get(p.packageId) : undefined;
    if (!old) {
      await logActivity(ctx, actor, {
        category: "package",
        action: "Added",
        summary: `Added package form ${packageLabel(p)}`,
        drug,
        detail: [
          `Stock ${p.stock}`,
          p.imageIds.length > 0 ? plural(p.imageIds.length, "picture") : "",
        ]
          .filter(Boolean)
          .join(" · "),
      });
      continue;
    }
    kept.add(old._id);
    const changes = diffPackage(old, p);
    if (changes.length > 0) {
      await logActivity(ctx, actor, {
        category: "package",
        action: "Edited",
        summary: `Edited package form ${packageLabel(p)}`,
        drug,
        changes,
      });
    }
    const added = countNew(p.imageIds, old.imageIds);
    const removed = countNew(old.imageIds, p.imageIds);
    if (added + removed > 0) {
      await logActivity(ctx, actor, {
        category: "photo",
        action: "Changed",
        summary: `Packaging pictures for ${packageLabel(p)}`,
        drug,
        detail: pictureDetail(added, removed),
      });
    }
  }
  for (const old of s.beforePackages) {
    if (kept.has(old._id)) continue;
    await logActivity(ctx, actor, {
      category: "package",
      action: "Removed",
      summary: `Removed package form ${packageLabel(old)}`,
      drug,
      detail: `Had stock ${old.stock}`,
    });
  }
}

// One entry per medicine created or updated from a spreadsheet import
export async function logDrugImport(
  ctx: MutationCtx,
  actor: Actor,
  s: DrugSave,
) {
  const { drug, before, after } = s;
  const changes = diffDrugFields(before, after);
  const byId = new Map(s.beforePackages.map((p) => [p._id, p]));
  for (const p of s.afterPackages) {
    const old = p.packageId ? byId.get(p.packageId) : undefined;
    if (!old) {
      changes.push({
        field: "Package form added",
        before: "",
        after: packageLabel(p),
      });
    } else {
      for (const c of diffPackage(old, p)) {
        changes.push({
          ...c,
          field: `${c.field} (${old.barcode || "no barcode"})`,
        });
      }
    }
  }
  if (before && changes.length === 0) return;
  await logActivity(ctx, actor, {
    category: "import",
    action: before ? "Updated" : "Added",
    summary: `${before ? "Updated" : "Added"} ${after.name} from import`,
    drug,
    changes,
  });
}

export async function logDrugDelete(
  ctx: MutationCtx,
  actor: Actor,
  drug: Doc<"drugs">,
  packages: SavedPackage[],
  via: "form" | "import",
) {
  const stock = packages.reduce((sum, p) => sum + p.stock, 0);
  await logActivity(ctx, actor, {
    category: via === "import" ? "import" : "medicine",
    action: "Deleted",
    summary: `Deleted ${drug.name}${via === "import" ? " (not in import file)" : ""}`,
    drug,
    detail: `${plural(packages.length, "package form")}, total stock ${stock}${
      packages.length > 0 ? `: ${packages.map(packageLabel).join("; ")}` : ""
    }`,
  });
}

// ---------- Stock ----------

function drugOfMovement(m: Doc<"stockMovements">) {
  return { _id: m.drugRef, drugId: m.drugCode, name: m.drugName };
}

export async function logMovement(ctx: MutationCtx, m: Doc<"stockMovements">) {
  const sign = m.kind === "in" ? "+" : "−";
  await logActivity(
    ctx,
    { userRef: m.userRef, userName: m.userName },
    {
      category: m.kind === "in" ? "stock_in" : "stock_out",
      action: m.kind === "in" ? "Stock In" : "Stock Out",
      summary: `${sign}${m.quantity} ${m.drugName} (${formatPackageForm(m)})`,
      drug: drugOfMovement(m),
      detail: [
        m.barcode || "No barcode",
        `Stock ${m.stockBefore} → ${m.stockAfter}`,
        m.reason ?? "",
        m.canister ? formatCanister(m.canister) : formatBatchExpiry(m),
        formatMismatchedScan(m.mismatchedScan),
        m.notes,
      ]
        .filter(Boolean)
        .join(" · "),
      movementRef: m._id,
      occurredAt: m.occurredAt,
    },
  );
}

export async function logUndo(ctx: MutationCtx, m: Doc<"stockMovements">) {
  if (!m.undo) return;
  const sign = m.kind === "in" ? "+" : "−";
  await logActivity(
    ctx,
    { userRef: m.undo.userRef, userName: m.undo.userName },
    {
      category: "undo",
      action: "Undo",
      summary: `Undid ${m.kind === "in" ? "Stock In" : "Stock Out"} ${sign}${m.quantity} ${m.drugName} (${formatPackageForm(m)})`,
      drug: drugOfMovement(m),
      detail: [
        m.undo.reason,
        `Stock ${m.undo.stockBefore} → ${m.undo.stockAfter}`,
        `Originally by ${m.userName}`,
      ].join(" · "),
      movementRef: m._id,
      occurredAt: m.undo.undoneAt,
    },
  );
}
