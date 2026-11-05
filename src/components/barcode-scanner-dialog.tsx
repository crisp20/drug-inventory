import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { CameraOff, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (code: string) => void;
};

const CAMERA_SUPPORTED = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

function CameraView({ onDetected }: { onDetected: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(
    CAMERA_SUPPORTED ? null : "This device or browser does not support camera scanning.",
  );
  const [attempt, setAttempt] = useState(0);

  // Camera stream is an external system, so an effect is the right tool here
  useEffect(() => {
    if (!CAMERA_SUPPORTED) return;
    let controls: IScannerControls | undefined;
    let stopped = false;
    const reader = new BrowserMultiFormatReader();
    reader
      .decodeFromConstraints(
        { video: { facingMode: "environment" } },
        videoRef.current ?? undefined,
        (result, _err, ctrl) => {
          if (result && !stopped) {
            stopped = true;
            ctrl.stop();
            onDetected(result.getText());
          }
        },
      )
      .then((c) => {
        controls = c;
        if (stopped) c.stop();
      })
      .catch(() =>
        setError(
          "Camera access was blocked. Allow camera access in your browser settings, then try again.",
        ),
      );
    return () => {
      stopped = true;
      controls?.stop();
    };
  }, [onDetected, attempt]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <CameraOff className="size-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button
          variant="secondary"
          onClick={() => {
            setError(null);
            setAttempt((a) => a + 1);
          }}
        >
          Check again
        </Button>
      </div>
    );
  }
  return (
    <div className="relative overflow-hidden rounded-xl bg-black">
      <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
      <div className="pointer-events-none absolute inset-x-10 top-1/2 h-0.5 -translate-y-1/2 bg-[oklch(0.88_0.17_95)] shadow-[0_0_12px_oklch(0.88_0.17_95)]" />
    </div>
  );
}

export default function BarcodeScannerDialog({ open, onOpenChange, onDetected }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="size-5" /> Scan barcode
          </DialogTitle>
          <DialogDescription>
            Point the camera at a barcode or GS1 DataMatrix code.
          </DialogDescription>
        </DialogHeader>
        {open && <CameraView onDetected={onDetected} />}
      </DialogContent>
    </Dialog>
  );
}
