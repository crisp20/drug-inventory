import { cn } from "@/lib/utils.ts";

export const LOGO_URL = "/ACP.jpg";

export default function BrandLogo({
  className,
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img src={LOGO_URL} alt="ACP" className="size-9 rounded-lg object-cover shadow-sm" />
      {showText && (
        <div className="leading-tight">
          <div className="text-base font-extrabold tracking-tight">ACP Stock</div>
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] opacity-70">
            Inventory
          </div>
        </div>
      )}
    </div>
  );
}
