// Shared by the browser upload and the backend: photo files are named by Drug ID (e.g. "25.jpg")

export const MAX_PHOTO_BATCH = 50;
export const MAX_PHOTO_CHECK = 200;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

const IMAGE_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export type PhotoName = { drugId: string; contentType: string };

// Returns the Drug ID and image type for a photo path, or null for non-photos and system files
export function parsePhotoName(path: string): PhotoName | null {
  const parts = path.split(/[\\/]/);
  // macOS zips add "__MACOSX/._name" copies that are not real images
  if (parts.some((p) => p === "__MACOSX")) return null;
  const file = parts[parts.length - 1] ?? "";
  if (!file || file.startsWith(".")) return null;
  const dot = file.lastIndexOf(".");
  if (dot <= 0) return null;
  const contentType = IMAGE_TYPES[file.slice(dot + 1).toLowerCase()];
  if (!contentType) return null;
  const drugId = file.slice(0, dot).trim();
  return drugId ? { drugId, contentType } : null;
}

// Keeps one photo per Drug ID (the last one wins) and reports the duplicates
export function dedupePhotos<T extends { drugId: string; fileName: string }>(photos: T[]) {
  const byId = new Map<string, T>();
  const duplicates: string[] = [];
  for (const p of photos) {
    const earlier = byId.get(p.drugId);
    if (earlier) duplicates.push(earlier.fileName);
    byId.set(p.drugId, p);
  }
  return { photos: [...byId.values()], duplicates };
}
