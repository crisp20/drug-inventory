import { Factory } from "lucide-react";
import { cn } from "@/lib/utils.ts";

// Small manufacturer line shown on drug cards; renders nothing when no manufacturer is saved
export default function ManufacturerLine({ manufacturer, className }: { manufacturer: string; className?: string }) {
  if (!manufacturer) return null;
  return (
    <div className={cn("flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <Factory className="size-3.5 shrink-0" />
      <span className="truncate">{manufacturer}</span>
    </div>
  );
}
