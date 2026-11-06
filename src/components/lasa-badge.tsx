import { TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge.tsx";
import { cn } from "@/lib/utils.ts";

// Warning tag for drugs marked "Look Alike, Sound Alike"
export default function LasaBadge({ className }: { className?: string }) {
  return (
    <Badge
      className={cn(
        "gap-1 border-destructive/30 bg-destructive/10 font-semibold text-destructive dark:bg-destructive/20",
        className,
      )}
      variant="outline"
    >
      <TriangleAlert className="size-3" />
      Look Alike, Sound Alike
    </Badge>
  );
}
