import { Pill } from "lucide-react";
import { cn } from "@/lib/utils.ts";

export default function DrugImage({
  url,
  alt,
  className,
}: {
  url: string | null | undefined;
  alt: string;
  className?: string;
}) {
  if (!url) {
    return (
      <div className={cn("flex items-center justify-center rounded-lg bg-secondary text-secondary-foreground", className)}>
        <Pill className="size-1/3" />
      </div>
    );
  }
  return <img src={url} alt={alt} className={cn("rounded-lg bg-muted object-contain", className)} />;
}
