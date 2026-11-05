import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { TimerReset } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import { MAX_IDLE_TIMEOUT_MINUTES } from "@/convex/lib/settings.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { errorMessage } from "@/lib/errors.ts";

export default function IdleRefreshSetting() {
  const settings = useQuery(api.settings.get, {});
  if (settings === undefined)
    return <Skeleton className="h-40 w-full rounded-xl" />;
  return (
    <IdleRefreshForm
      key={settings.idleTimeoutMinutes}
      minutes={settings.idleTimeoutMinutes}
    />
  );
}

function IdleRefreshForm({ minutes }: { minutes: number }) {
  const save = useMutation(api.settings.setIdleTimeout);
  const [value, setValue] = useState(String(minutes));
  const [saving, setSaving] = useState(false);
  const n = Number(value);
  const valid =
    value !== "" &&
    Number.isInteger(n) &&
    n >= 0 &&
    n <= MAX_IDLE_TIMEOUT_MINUTES;

  const handleSave = async () => {
    setSaving(true);
    try {
      await save({ idleTimeoutMinutes: n });
      toast.success(
        n === 0
          ? "Idle refresh turned off"
          : `Idle refresh set to ${n} minute(s)`,
      );
    } catch (e) {
      toast.error(errorMessage(e, "Could not save setting"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <TimerReset className="size-5" />
        </div>
        <div>
          <h2 className="font-bold">Idle refresh</h2>
          <p className="text-sm text-muted-foreground">
            After this many minutes without use, everyone is asked to refresh
            the app before carrying on. Set to 0 to turn it off. A refresh is
            always asked for after a new version or a lost connection.
          </p>
        </div>
      </div>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && n !== minutes) void handleSave();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="idle-minutes">Ask to refresh after (minutes)</Label>
          <Input
            id="idle-minutes"
            inputMode="numeric"
            value={value}
            onChange={(e) =>
              setValue(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            className="h-11 w-40 text-lg font-bold"
          />
        </div>
        <Button
          type="submit"
          className="h-11"
          disabled={!valid || n === minutes || saving}
        >
          {saving && <Spinner />}
          Save
        </Button>
      </form>
      {!valid && (
        <p className="text-sm text-destructive">
          Enter a whole number from 0 to {MAX_IDLE_TIMEOUT_MINUTES}
        </p>
      )}
    </section>
  );
}
