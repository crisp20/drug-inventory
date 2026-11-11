import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Navigate } from "react-router-dom";
import { format } from "date-fns";
import { CalendarClock, Pill, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import { MAX_EXPIRY_WARNING_MONTHS } from "@/convex/lib/expiry.ts";
import { MAX_MOVEMENT_QUANTITY } from "@/convex/lib/stock.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import PageHeader from "@/components/page-header.tsx";
import { useCurrentUser } from "@/hooks/use-current-user.ts";
import { useKeycloakRoles } from "@/hooks/use-keycloak-roles.ts";
import { errorMessage } from "@/lib/errors.ts";
import IdleRefreshSetting from "./_components/idle-refresh-setting.tsx";
import { KeycloakClientRole } from "@/convex/lib/keycloakRoles.ts";

export default function SettingsPage() {
  const me = useCurrentUser();
  const { hasRole } = useKeycloakRoles();
  if (me === undefined) return null;
  if (!me || !hasRole(KeycloakClientRole.settings)) return <Navigate to="/" replace />;
  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <PageHeader
        title="Settings"
        description="App-wide options for everyone using ACP Stock."
      />
      <div className="space-y-6">
        <LargeQuantitySetting />
        <ExpiryWarningSetting />
        <IdleRefreshSetting />
        <CanisterRolloutSetting />
      </div>
    </div>
  );
}

function ExpiryWarningSetting() {
  const settings = useQuery(api.settings.get, {});
  if (settings === undefined)
    return <Skeleton className="h-40 w-full rounded-xl" />;
  return (
    <ExpiryWarningForm
      key={settings.expiryWarningMonths}
      months={settings.expiryWarningMonths}
    />
  );
}

function ExpiryWarningForm({ months }: { months: number }) {
  const save = useMutation(api.settings.setExpiryWarning);
  const [value, setValue] = useState(String(months));
  const [saving, setSaving] = useState(false);
  const n = Number(value);
  const valid =
    value !== "" &&
    Number.isInteger(n) &&
    n >= 0 &&
    n <= MAX_EXPIRY_WARNING_MONTHS;

  const handleSave = async () => {
    setSaving(true);
    try {
      await save({ expiryWarningMonths: n });
      toast.success(
        n === 0
          ? "Expiry warning turned off"
          : `Expiry warning set to ${n} month(s)`,
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
          <CalendarClock className="size-5" />
        </div>
        <div>
          <h2 className="font-bold">Expiry warning</h2>
          <p className="text-sm text-muted-foreground">
            When filling a canister, stock expiring within this many months
            shows a warning and asks staff to confirm. Expired stock is always
            blocked. Set to 0 to turn the warning off.
          </p>
        </div>
      </div>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && n !== months) void handleSave();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="expiry-months">
            Warn if expiring within (months)
          </Label>
          <Input
            id="expiry-months"
            inputMode="numeric"
            value={value}
            onChange={(e) =>
              setValue(e.target.value.replace(/\D/g, "").slice(0, 2))
            }
            className="h-11 w-40 text-lg font-bold"
          />
        </div>
        <Button
          type="submit"
          className="h-11"
          disabled={!valid || n === months || saving}
        >
          {saving && <Spinner />}
          Save
        </Button>
      </form>
      {!valid && (
        <p className="text-sm text-destructive">
          Enter a whole number from 0 to {MAX_EXPIRY_WARNING_MONTHS}
        </p>
      )}
    </section>
  );
}

function CanisterRolloutSetting() {
  const settings = useQuery(api.settings.get, {});
  const setRollout = useMutation(api.settings.setCanisterRollout);
  const [saving, setSaving] = useState(false);
  if (settings === undefined)
    return <Skeleton className="h-32 w-full rounded-xl" />;
  const toggle = async (on: boolean) => {
    setSaving(true);
    try {
      await setRollout({ canisterForEveryone: on });
      toast.success(
        on
          ? "Canister features rolled out to everyone"
          : "Canister features limited to selected people",
      );
    } catch (e) {
      toast.error(errorMessage(e, "Could not save setting"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="space-y-3 rounded-xl border bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Pill className="size-5" />
        </div>
        <div className="flex-1">
          <h2 className="font-bold">Canister features</h2>
          <p className="text-sm text-muted-foreground">
            The Canister section on Stock Out. While this is off, only people
            you switch on in the Users page can see it.
          </p>
        </div>
        <Switch
          checked={settings.canisterForEveryone}
          disabled={saving}
          onCheckedChange={(v) => void toggle(v)}
          aria-label="Roll out canister features to everyone"
          className="mt-1 cursor-pointer"
        />
      </div>
      <p className="text-sm font-medium">
        {settings.canisterForEveryone
          ? "Rolled out: everyone can use it."
          : "Not rolled out: selected people only."}
      </p>
    </section>
  );
}

function LargeQuantitySetting() {
  const settings = useQuery(api.settings.get, {});
  if (settings === undefined)
    return <Skeleton className="h-48 w-full rounded-xl" />;
  return (
    <LargeQuantityForm key={settings.updatedAt ?? "default"} {...settings} />
  );
}

type FormProps = {
  largeQuantityThreshold: number;
  updatedAt: string | null;
  updatedByName: string | null;
};

function LargeQuantityForm({
  largeQuantityThreshold,
  updatedAt,
  updatedByName,
}: FormProps) {
  const update = useMutation(api.settings.update);
  const [value, setValue] = useState(String(largeQuantityThreshold));
  const [saving, setSaving] = useState(false);
  const n = Number(value);
  const valid = Number.isInteger(n) && n >= 1 && n <= MAX_MOVEMENT_QUANTITY;
  const changed = n !== largeQuantityThreshold;

  const handleSave = async () => {
    setSaving(true);
    try {
      await update({ largeQuantityThreshold: n });
      toast.success(`Large quantity check set to ${n.toLocaleString()}`);
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
          <ShieldAlert className="size-5" />
        </div>
        <div>
          <h2 className="font-bold">Large quantity check</h2>
          <p className="text-sm text-muted-foreground">
            When a Stock In or Stock Out is this amount or more, staff are asked
            to confirm it again. This catches barcodes accidentally scanned into
            the quantity box.
          </p>
        </div>
      </div>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && changed) void handleSave();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="large-qty">Ask to confirm at or above</Label>
          <Input
            id="large-qty"
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value.trim())}
            className="h-11 w-40 text-lg font-bold"
          />
        </div>
        <Button
          type="submit"
          className="h-11"
          disabled={!valid || !changed || saving}
        >
          {saving && <Spinner />}
          Save
        </Button>
      </form>
      {!valid && (
        <p className="text-sm text-destructive">
          Enter a whole number from 1 to{" "}
          {MAX_MOVEMENT_QUANTITY.toLocaleString()}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {updatedAt && updatedByName
          ? `Last changed by ${updatedByName} on ${format(new Date(updatedAt), "d MMM yyyy, h:mm a")}`
          : "Using the default of 100."}
      </p>
    </section>
  );
}
