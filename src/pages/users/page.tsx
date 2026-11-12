import { useAction, useMutation, useQuery } from "convex/react";
import { Navigate } from "react-router-dom";
import { ChevronDown, Crown, KeyRound, Pill, Users } from "lucide-react";
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
import { useKeycloakRoles } from "@/hooks/use-keycloak-roles.ts";
import { errorMessage } from "@/lib/errors.ts";
import InitialsField from "./_components/initials-field.tsx";
import { authorityRank, KeycloakClientRole } from "@/convex/lib/keycloakRoles.ts";
import { useEffect, useState } from "react";
import type { RoleGroup } from "@/convex/lib/keycloak.ts";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { Button } from "@/components/ui/button.tsx";

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

function RoleGroupMenu({
  user,
  roleGroups,
  isSelf,
  selfAuthorityRank,
  setUserGroupMembership,
}: {
  user: Doc<"users">;
  roleGroups: RoleGroup[];
  isSelf: boolean;
  selfAuthorityRank: number;
  setUserGroupMembership: (param: { userId: string, groupId: string, isMember: boolean }) => Promise<null>
}) {

  const userAuthorityRank: number = roleGroups.filter(({ members }) => members.includes(user.keycloakUserId)).flatMap(({ clientRoles }) => clientRoles).map(authorityRank).reduce((a, b) => Math.max(a, b), 0)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={roleGroups.length === 0}
          aria-label={`Keycloak group roles for ${user.name ?? user.email ?? "user"}`}
        >
          <KeyRound />
          Role Groups
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Role Groups</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {roleGroups.map((group) => (
          <DropdownMenuCheckboxItem
            key={group.id}
            checked={group.members.includes(user.keycloakUserId)}
            disabled={
              // this user has more authority than self, not allowed to modify
              selfAuthorityRank <= userAuthorityRank ||
              // this user is self, not allowed to modify
              isSelf ||
              // this role has more authority than self, not allowed to modify
              selfAuthorityRank <= group.clientRoles.map(authorityRank).reduce((a, b) => Math.max(a, b), 0)
            }
            title={group.path}
            aria-label={`${group.path}: ${group.clientRoles.join(", ") || "no client roles"}`}
            onClick={async () => {
              await setUserGroupMembership({
                userId: user.keycloakUserId,
                groupId: group.id,
                isMember: !group.members.includes(user.keycloakUserId)
              })
            }}
          >
            <span>{group.clientRoles.join(", ") || "No client roles"}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserRow({
  user,
  isSelf,
  selfAuthorityRank,
  roleGroups,
  setUserGroupMembership,
}: {
  user: Doc<"users">;
  isSelf: boolean;
  selfAuthorityRank: number
  roleGroups: RoleGroup[];
  setUserGroupMembership: (param: { userId: string, groupId: string, isMember: boolean }) => Promise<null>
}) {
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
        <div className="text-sm break-all text-muted-foreground">
          {user.keycloakUserId}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <InitialsField user={user} />
        <RoleGroupMenu user={user} roleGroups={roleGroups} isSelf={isSelf} selfAuthorityRank={selfAuthorityRank} setUserGroupMembership={setUserGroupMembership} />
        <CanisterAccessToggle user={user} />
      </div>
    </div>
  );
}

function UserList({ userKeycloakId }: { userKeycloakId: string }) {
  const users = useQuery(api.users.listAll, {});
  const getManagedGroupsAndMembers = useAction(api.keycloak.getManagedGroupsAndMembers);
  const setUserGroupMembership = useAction(api.keycloak.setUserGroupMembership);

  const [roleGroups, setRoleGroups] = useState<RoleGroup[]>([]);
  const [roleLoadError, setRoleLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getManagedGroupsAndMembers()
      .then(({ roleGroups }) => {
        if (active) setRoleGroups(roleGroups);
      })
      .catch((error: unknown) => {
        if (active) {
          setRoleLoadError(
            errorMessage(error, "Could not load Keycloak role assignments"),
          );
        }
      });
    return () => {
      active = false;
    };
  }, [getManagedGroupsAndMembers]);

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
    <>
      {roleLoadError && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {roleLoadError}
        </p>
      )}
      <div className="space-y-3">
        {users.map((u) => (
          <UserRow
            key={u._id}
            user={u}
            isSelf={u.keycloakUserId == userKeycloakId}
            selfAuthorityRank={roleGroups.filter(({ members }) => members.includes(userKeycloakId)).flatMap(({ clientRoles }) => clientRoles).map(authorityRank).reduce((a, b) => Math.max(a, b), 0)}
            roleGroups={roleGroups}
            setUserGroupMembership={setUserGroupMembership}
          />
        ))}
      </div>
    </>
  );
}

export default function UsersPage() {
  const me = useCurrentUser();
  const { hasRole } = useKeycloakRoles();
  if (me === undefined) return null;
  if (!me || !hasRole(KeycloakClientRole.users))
    return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <PageHeader
        title="Users"
        description="Manage user-specific label initials and canister feature access. Assign access and admin roles in Keycloak."
      />
      <UserList userKeycloakId={me.keycloakUserId} />
    </div>
  );
}
