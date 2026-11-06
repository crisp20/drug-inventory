import { ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge.tsx";
import { cn } from "@/lib/utils.ts";

// Tag for drugs marked Dangerous Drug (DDA)
export default function DdaBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border-amber-500/40 bg-amber-500/10 font-semibold text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/15 dark:text-amber-300",
        className,
      )}
    >
      <ShieldAlert className="size-3" />
      DDA
    </Badge>
  );
}
