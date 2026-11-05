import { useRef, useState } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner.tsx";
import CameraCaptureDialog from "@/components/camera-capture-dialog.tsx";
import { useUploadImage } from "@/hooks/use-upload-image.ts";
import { useConfirm } from "@/hooks/use-confirm.ts";
import { cn } from "@/lib/utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

export type PickedImage = { id: Id<"_storage">; url: string | null };

type Props = {
  images: PickedImage[];
  onChange: (images: PickedImage[]) => void;
  max: number;
  size?: "md" | "sm";
};

const TILE = { md: "size-20", sm: "size-16" } as const;

export default function ImagePicker({ images, onChange, max, size = "md" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadImage();
  const [uploading, setUploading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const confirm = useConfirm();
  const tile = TILE[size];

  const uploadFiles = async (files: File[]) => {
    const chosen = files.slice(0, max - images.length);
    if (!chosen.length) return;
    setUploading(true);
    try {
      const added: PickedImage[] = [];
      for (const file of chosen) {
        const id = await upload(file);
        added.push({ id, url: URL.createObjectURL(file) });
      }
      onChange([...images, ...added]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const confirmRemove = async (id: Id<"_storage">) => {
    const ok = await confirm({
      title: "Remove this picture?",
      description: "The picture will be removed when you save.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (ok) onChange(images.filter((i) => i.id !== id));
  };

  const actionTile = cn(
    tile,
    "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-wait",
  );

  return (
    <div className="flex flex-wrap gap-2">
      {images.map((img) => (
        <div key={img.id} className={cn("relative", tile)}>
          {img.url && (
            <a href={img.url} target="_blank" rel="noreferrer" className="cursor-zoom-in">
              <img src={img.url} alt="" className={cn(tile, "rounded-lg border object-cover")} />
            </a>
          )}
          <button
            type="button"
            onClick={() => void confirmRemove(img.id)}
            className="absolute -right-2 -top-2 flex size-6 cursor-pointer items-center justify-center rounded-full bg-destructive text-white shadow"
            aria-label="Remove picture"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      {images.length < max &&
        (uploading ? (
          <div className={cn(actionTile, "cursor-wait")}>
            <Spinner />
            Uploading
          </div>
        ) : (
          <>
            <button type="button" onClick={() => setCameraOpen(true)} className={actionTile}>
              <Camera className="size-5" />
              Camera
            </button>
            <button type="button" onClick={() => inputRef.current?.click()} className={actionTile}>
              <ImagePlus className="size-5" />
              Upload
            </button>
          </>
        ))}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={max > 1}
        className="hidden"
        onChange={(e) => void uploadFiles(Array.from(e.target.files ?? []))}
      />
      <CameraCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={(file) => void uploadFiles([file])}
      />
    </div>
  );
}
