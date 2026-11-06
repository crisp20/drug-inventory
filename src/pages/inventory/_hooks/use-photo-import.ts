import { useState } from "react";
import { useConvex, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { MAX_PHOTO_BATCH, MAX_PHOTO_CHECK } from "@/convex/lib/drugPhotos.ts";
import { useUploadImage } from "@/hooks/use-upload-image.ts";
import type { PickedPhoto } from "../_lib/read-photo-files.ts";

export type PhotoMatch = PickedPhoto & { name: string; hasPhoto: boolean; photoUrl: string | null };

export type PhotoReview = { matched: PhotoMatch[]; notFound: PickedPhoto[] };

export type PhotoReport = { applied: number; failed: { drugId: string; message: string }[] };

type Progress = { label: string; done: number; total: number } | null;

// Uploads run a few at a time so large batches finish quickly without flooding the connection
const PARALLEL_UPLOADS = 6;

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function usePhotoImport() {
  const convex = useConvex();
  const upload = useUploadImage();
  const setPhotos = useMutation(api.drugPhotos.setPhotos);
  const [progress, setProgress] = useState<Progress>(null);

  const check = async (photos: PickedPhoto[]): Promise<PhotoReview> => {
    const review: PhotoReview = { matched: [], notFound: [] };
    const batches = chunks(photos, MAX_PHOTO_CHECK);
    try {
      for (let i = 0; i < batches.length; i++) {
        setProgress({ label: "Matching photos to Drug IDs", done: i, total: batches.length });
        const results = await convex.query(api.drugPhotos.checkPhotos, { drugIds: batches[i].map((p) => p.drugId) });
        results.forEach((r, j) => {
          const photo = batches[i][j];
          if (r.found) review.matched.push({ ...photo, name: r.name, hasPhoto: r.hasPhoto, photoUrl: r.photoUrl });
          else review.notFound.push(photo);
        });
      }
      return review;
    } finally {
      setProgress(null);
    }
  };

  const run = async (photos: PhotoMatch[]): Promise<PhotoReport> => {
    const report: PhotoReport = { applied: 0, failed: [] };
    const batches = chunks(photos, MAX_PHOTO_BATCH);
    let done = 0;
    try {
      for (const batch of batches) {
        const items: { drugId: string; storageId: Id<"_storage"> }[] = [];
        for (const group of chunks(batch, PARALLEL_UPLOADS)) {
          setProgress({ label: "Uploading photos", done, total: photos.length });
          const results = await Promise.allSettled(group.map((p) => upload(p.file)));
          results.forEach((r, i) => {
            if (r.status === "fulfilled") items.push({ drugId: group[i].drugId, storageId: r.value });
            else report.failed.push({ drugId: group[i].drugId, message: "Upload failed" });
          });
          done += group.length;
        }
        if (items.length === 0) continue;
        const res = await setPhotos({ items });
        report.applied += res.applied;
        report.failed.push(...res.notFound.map((drugId) => ({ drugId, message: "Drug was deleted" })));
      }
      return report;
    } finally {
      setProgress(null);
    }
  };

  return { check, run, progress };
}
