import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, RotateCcw, SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";

type FacingMode = "user" | "environment";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
  title?: string;
};

const CAMERA_SUPPORTED = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

function cameraErrorMessage(e: unknown): string {
  const name = e instanceof Error ? e.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Camera access was blocked. Allow camera access in your browser settings, then try again.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "No camera was found on this device.";
  if (name === "NotReadableError") return "The camera is being used by another app. Close it and try again.";
  return "Could not start the camera.";
}

function CameraCapture({ onCapture }: { onCapture: (file: File) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [facing, setFacing] = useState<FacingMode>("environment");
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(
    CAMERA_SUPPORTED ? null : "This device or browser does not support the camera.",
  );
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);

  // The camera stream is an external system, so an effect is the right tool here
  useEffect(() => {
    if (!CAMERA_SUPPORTED || preview) return;
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch((e: unknown) => setError(cameraErrorMessage(e)));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      setReady(false);
    };
  }, [facing, attempt, preview]);

  // Revoke the preview URL when it is replaced or the dialog closes
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url);
  }, [preview]);

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) setPreview({ url: URL.createObjectURL(blob), blob });
      },
      "image/jpeg",
      0.9,
    );
  };

  const usePhoto = () => {
    if (!preview) return;
    onCapture(new File([preview.blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }));
  };

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <CameraOff className="size-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{error}</p>
        {CAMERA_SUPPORTED && (
          <Button
            variant="secondary"
            onClick={() => {
              setError(null);
              setAttempt((a) => a + 1);
            }}
          >
            Check again
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-xl bg-black">
        {preview ? (
          <img src={preview.url} alt="Captured" className="aspect-[4/3] w-full object-contain" />
        ) : (
          <video
            ref={videoRef}
            onLoadedData={() => setReady(true)}
            className="aspect-[4/3] w-full object-cover"
            autoPlay
            muted
            playsInline
          />
        )}
      </div>
      <DialogFooter className="gap-2 sm:justify-between">
        {preview ? (
          <>
            <Button type="button" variant="secondary" onClick={() => setPreview(null)}>
              <RotateCcw /> Retake
            </Button>
            <Button type="button" onClick={usePhoto}>
              Use photo
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
            >
              <SwitchCamera /> Switch camera
            </Button>
            <Button type="button" size="lg" onClick={takePhoto} disabled={!ready}>
              <Camera /> Take photo
            </Button>
          </>
        )}
      </DialogFooter>
    </div>
  );
}

export default function CameraCaptureDialog({ open, onOpenChange, onCapture, title }: Props) {
  const handleCapture = useCallback(
    (file: File) => {
      onCapture(file);
      onOpenChange(false);
    },
    [onCapture, onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="size-5" /> {title ?? "Take a picture"}
          </DialogTitle>
          <DialogDescription>Hold the item steady in good light, then take the photo.</DialogDescription>
        </DialogHeader>
        {open && <CameraCapture onCapture={handleCapture} />}
      </DialogContent>
    </Dialog>
  );
}
