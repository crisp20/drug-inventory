import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { api } from "@/convex/_generated/api.js";
import {
  initialsOf,
  isValidInitials,
  MAX_INITIALS_LENGTH,
  normalizeInitials,
} from "@/convex/lib/initials.ts";
import { Input } from "@/components/ui/input.tsx";
import { errorMessage } from "@/lib/errors.ts";

// Admin: initials printed on this person's Stock In and canister labels.
// Saved when the box loses focus or Enter is pressed; blank uses the name's initials.
export default function InitialsField({ user }: { user: Doc<"users"> }) {
  const setInitials = useMutation(api.users.setInitials);
  const saved = user.initials ?? "";
  const [value, setValue] = useState(saved);
  const fallback = initialsOf(user.name ?? user.email);

  const save = async () => {
    const next = normalizeInitials(value);
    setValue(next);
    if (next === saved) return;
    if (next !== "" && !isValidInitials(next)) {
      toast.error(
        `Initials must be 1 to ${MAX_INITIALS_LENGTH} letters or numbers`,
      );
      setValue(saved);
      return;
    }
    try {
      await setInitials({ userId: user._id, initials: next });
      toast.success(`Label initials for ${user.name ?? "this user"} saved`);
    } catch (e) {
      toast.error(errorMessage(e, "Could not save the initials"));
      setValue(saved);
    }
  };

  return (
    <label className="flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1 text-sm">
      Initials
      <Input
        value={value}
        maxLength={MAX_INITIALS_LENGTH}
        placeholder={fallback || "HS"}
        onChange={(e) =>
          setValue(e.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase())
        }
        onBlur={() => void save()}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        aria-label="Label initials"
        className="h-7 w-16 bg-background px-2 text-center font-bold uppercase"
      />
    </label>
  );
}
