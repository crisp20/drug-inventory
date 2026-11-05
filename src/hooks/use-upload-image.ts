import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export function useUploadImage() {
  const generateUploadUrl = useMutation(api.drugs.generateUploadUrl);
  return async (file: File): Promise<Id<"_storage">> => {
    if (!file.type.startsWith("image/")) throw new Error("Please choose an image file");
    if (file.size > MAX_IMAGE_BYTES) throw new Error("Images must be under 8 MB");
    const url = await generateUploadUrl();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!res.ok) throw new Error("Upload failed");
    const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
    return storageId;
  };
}
