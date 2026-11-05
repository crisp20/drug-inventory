import { cn } from "@/lib/utils.ts";

type Props = { specifications?: string; remarks?: string; className?: string };

// Specifications and Remarks in full, shown on drug cards; renders nothing when both are blank
export default function DrugNotes({ specifications, remarks, className }: Props) {
  const notes = [
    { label: "Specifications", text: specifications },
    { label: "Remarks", text: remarks },
  ].filter((n) => n.text);
  if (notes.length === 0) return null;
  return (
    <div className={cn("space-y-1 text-xs", className)}>
      {notes.map((n) => (
        <p key={n.label} className="whitespace-pre-line break-words">
          <span className="font-semibold text-foreground">{n.label}: </span>
          <span className="text-muted-foreground">{n.text}</span>
        </p>
      ))}
    </div>
  );
}
