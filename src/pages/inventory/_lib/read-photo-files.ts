import { unzip } from "fflate";
import { MAX_PHOTO_BYTES, dedupePhotos, parsePhotoName } from "@/convex/lib/drugPhotos.ts";

const MAX_ZIP_BYTES = 200 * 1024 * 1024;

export type PickedPhoto = { drugId: string; fileName: string; file: File };

export type PickedPhotos = { photos: PickedPhoto[]; duplicates: string[]; ignored: string[] };

function unzipAsync(data: Uint8Array) {
  return new Promise<Record<string, Uint8Array>>((resolve, reject) =>
    unzip(data, (err, files) => (err ? reject(new Error("The zip file could not be opened")) : resolve(files))),
  );
}

async function fromZip(zip: File) {
  if (zip.size > MAX_ZIP_BYTES) throw new Error("Zip files must be under 200 MB");
  const entries = await unzipAsync(new Uint8Array(await zip.arrayBuffer()));
  return Object.entries(entries)
    .filter(([path]) => !path.endsWith("/"))
    .map(([path, data]) => {
      const name = parsePhotoName(path);
      const fileName = path.split("/").pop() ?? path;
      return { path, name, file: name ? new File([data.slice()], fileName, { type: name.contentType }) : null };
    });
}

// Reads chosen photos and zip files into one list of photos keyed by Drug ID (from the file name)
export async function readPhotoFiles(files: File[]): Promise<PickedPhotos> {
  const found: PickedPhoto[] = [];
  const ignored: string[] = [];
  for (const f of files) {
    const items = f.name.toLowerCase().endsWith(".zip")
      ? await fromZip(f)
      : [{ path: f.name, name: parsePhotoName(f.name), file: f }];
    for (const it of items) {
      // System files such as __MACOSX copies are dropped without a mention
      if (it.path.includes("__MACOSX") || (it.path.split("/").pop() ?? "").startsWith(".")) continue;
      if (!it.name || !it.file) ignored.push(it.path);
      else if (it.file.size > MAX_PHOTO_BYTES) ignored.push(`${it.path} (over 8 MB)`);
      else found.push({ drugId: it.name.drugId, fileName: it.path, file: it.file });
    }
  }
  const { photos, duplicates } = dedupePhotos(found);
  return { photos, duplicates, ignored };
}
