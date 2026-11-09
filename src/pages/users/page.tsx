import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Navigate } from "react-router-dom";
import { Pill, UserCheck, UserX, Users } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import PageHeader from "@/components/page-header.tsx";
import { useCurrentUser } from "@/hooks/use-current-user.ts";
import { useConfirm } from "@/hooks/use-confirm.ts";
import { errorMessage } from "@/lib/errors.ts";
import InitialsField from "./_components/initials-field.tsx";

type Status = "pending" | "active" | "disabled";
type Role = "admin" | "staff";

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
  const updateAccess = useMutation(api.users.updateAccess);
  const role: Role = user.role ?? "staff";

  const save = async (next: { role?: Role; status?: Status }, done: string) => {
    try {
      await updateAccess({
        userId: user._id,
        role: next.role ?? role,
        status: next.status ?? user.status ?? "pending",
      });
      toast.success(done);
    } catch (e) {
      toast.error(errorMessage(e, "Could not update user"));
    }
  };

  const confirm = useConfirm();
  const removeAccess = async () => {
    const rejecting = user.status === "pending";
    const ok = await confirm({
      title: rejecting
        ? `Reject ${user.name ?? user.email ?? "this user"}?`
        : `Remove access for ${user.name ?? user.email ?? "this user"}?`,
      description:
        "They will no longer be able to use the app. You can approve them again later from the Removed tab.",
      confirmLabel: rejecting ? "Reject" : "Remove access",
      destructive: true,
    });
    if (ok)
      await save(
        { status: "disabled" },
        rejecting ? "User rejected" : "Access removed",
      );
  };

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
        {user.status === "active" && <InitialsField user={user} />}
        {user.status === "active" && <CanisterAccessToggle user={user} />}
        {!isSelf && (
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={role}
              onValueChange={(v) =>
                void save(
                  { role: v === "admin" ? "admin" : "staff" },
                  "Role updated",
                )
              }
            >
              <SelectTrigger className="w-28" aria-label="Role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            {user.status !== "active" && (
              <Button
                size="sm"
                onClick={() => void save({ status: "active" }, "User approved")}
              >
                <UserCheck /> Approve
              </Button>
            )}
            {user.status !== "disabled" && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => void removeAccess()}
              >
                <UserX />{" "}
                {user.status === "pending" ? "Reject" : "Remove access"}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function UserList({ status, selfId }: { status: Status; selfId: string }) {
  const users = useQuery(api.users.listByStatus, { status });
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
          <EmptyTitle>
            No {status === "active" ? "active" : status} users
          </EmptyTitle>
          <EmptyDescription>
            {status === "pending"
              ? "New people appear here after they sign in for the first time."
              : "Nobody here right now."}
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
  const [tab, setTab] = useState<Status>("pending");
  if (me === undefined) return null;
  if (!me || me.role !== "admin") return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <PageHeader
        title="Users"
        description="Approve new staff and choose who can manage inventory."
      />
      <Tabs
        value={tab}
        onValueChange={(v) =>
          setTab(v === "active" || v === "disabled" ? v : "pending")
        }
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="pending">Waiting approval</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="disabled">Removed</TabsTrigger>
        </TabsList>
        <UserList status={tab} selfId={me._id} />
      </Tabs>
    </div>
  );
}
