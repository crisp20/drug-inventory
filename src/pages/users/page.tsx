import { useMutation, useQuery } from "convex/react";
import { Navigate } from "react-router-dom";
import { Pill, Users } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import PageHeader from "@/components/page-header.tsx";
import { useCurrentUser } from "@/hooks/use-current-user.ts";
import { RoleCatelog, useKeycloakRoles } from "@/hooks/use-keycloak-roles.ts";
import { errorMessage } from "@/lib/errors.ts";
import InitialsField from "./_components/initials-field.tsx";

function CanisterAccessToggle({ user }: { user: Doc<"users"> }) {
  const setAccess = useMutation(api.users.setCanisterAccess);
  const settings = useQuery(api.settings.get, {});
  const forEveryone = settings?.canisterForEveryone ?? false;
  const on = user.canisterAccess === true;
  const toggle = async (enabled: boolean) => {
    try {
      await setAccess({ userId: user._id, enabled });
      toast.success(
        `Canister features ${enabled ? "on" : "off"} for ${user.name ?? user.email ?? "this user"}`,
      );
    } catch (e) {
      toast.error(errorMessage(e, "Could not update canister access"));
    }
  };
  return (
    <label
      className="flex cursor-pointer items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5 text-sm"
      title={
        forEveryone
          ? "Canister features are rolled out to everyone in Settings"
          : undefined
      }
    >
      <Pill className="size-4 text-primary" />
      Canister
      <Switch
        checked={forEveryone || on}
        disabled={forEveryone}
        onCheckedChange={(v) => void toggle(v)}
        aria-label="Canister features"
        className="cursor-pointer"
      />
    </label>
  );
}

function UserRow({ user, isSelf }: { user: Doc<"users">; isSelf: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      {/* Name and email get their own line so the controls never squeeze them out */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold break-words">
            {user.name ?? user.email ?? "Unnamed"}
          </span>
          {isSelf && <Badge variant="secondary">You</Badge>}
        </div>
        {user.name && (
          <div className="text-sm break-all text-muted-foreground">
            {user.email ?? "No email"}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <InitialsField user={user} />
        <CanisterAccessToggle user={user} />
      </div>
    </div>
  );
}

function UserList({ selfId }: { selfId: string }) {
  const users = useQuery(api.users.listAll, {});
  if (users === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (users.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Users />
          </EmptyMedia>
          <EmptyTitle>No users yet</EmptyTitle>
          <EmptyDescription>
            Users appear here after they sign in for the first time.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <div className="space-y-3">
      {users.map((u) => (
        <UserRow key={u._id} user={u} isSelf={u._id === selfId} />
      ))}
    </div>
  );
}

export default function UsersPage() {
  const me = useCurrentUser();
  const { hasRole } = useKeycloakRoles();
  if (me === undefined) return null;
  if (!me || !hasRole(RoleCatelog.users)) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <PageHeader
        title="Users"
        description="Manage user-specific label initials and canister feature access. Assign access and admin roles in Keycloak."
      />
      <UserList selfId={me._id} />
    </div>
  );
}
