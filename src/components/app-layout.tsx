import type { MouseEvent } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  History,
  ScrollText,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useCurrentUser } from "@/hooks/use-current-user.ts";
import { useKeycloakRoles } from "@/hooks/use-keycloak-roles.ts";
import { useUnsavedChangesApi } from "@/hooks/use-unsaved-changes.ts";
import { cn } from "@/lib/utils.ts";
import {
  AccessRequiredScreen,
  ProfileUnavailableScreen,
  SignedOutScreen,
} from "./access-screens.tsx";
import BrandLogo from "./brand-logo.tsx";
import RefreshReminder from "./refresh-reminder.tsx";
import { RootErrorBoundary } from "./root-error-boundary.tsx";
import { KeycloakClientRole } from "@/convex/lib/keycloakRoles.ts";

type NavItem = {
  label: string;
  icon: LucideIcon;
  to?: string;
  requires?: KeycloakClientRole;
};

const NAV: NavItem[] = [
  { label: "Inventory", icon: Boxes, to: "/" },
  { label: "Stock In", icon: ArrowDownToLine, to: "/stock-in" },
  { label: "Stock Out", icon: ArrowUpFromLine, to: "/stock-out" },
  { label: "Users", icon: Users, to: "/users", requires: KeycloakClientRole.users },
  { label: "Log", icon: ScrollText, to: "/log", requires: KeycloakClientRole.logs },
  { label: "Settings", icon: Settings, to: "/settings", requires: KeycloakClientRole.settings },
  { label: "Changes", icon: History, to: "/changes", requires: KeycloakClientRole.changes },
];

function NavEntry({ item, compact }: { item: NavItem; compact?: boolean }) {
  const navigate = useNavigate();
  const { hasUnsaved, confirmDiscard } = useUnsavedChangesApi();
  const base = compact
    ? "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium"
    : "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors";
  if (!item.to) {
    return (
      <button
        type="button"
        onClick={() => toast("Coming soon in a future milestone!")}
        className={cn(
          base,
          "cursor-pointer opacity-70 hover:opacity-100",
          !compact && "hover:bg-sidebar-accent",
        )}
      >
        <item.icon className="size-5" />
        {item.label}
      </button>
    );
  }
  const to = item.to;
  // Leaving a page with a half-filled form asks first
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!hasUnsaved()) return;
    e.preventDefault();
    void confirmDiscard().then((ok) => ok && navigate(to));
  };
  return (
    <NavLink
      to={to}
      end
      onClick={handleClick}
      className={({ isActive }) =>
        cn(
          base,
          "cursor-pointer",
          compact
            ? isActive
              ? "text-primary"
              : "text-muted-foreground"
            : isActive
              ? "bg-sidebar-primary text-sidebar-primary-foreground"
              : "hover:bg-sidebar-accent",
        )
      }
    >
      <item.icon className="size-5" />
      {item.label}
    </NavLink>
  );
}

function Shell() {
  const user = useCurrentUser();
  const { roles, hasRole } = useKeycloakRoles();
  if (!hasRole(KeycloakClientRole.access)) return <AccessRequiredScreen />;
  if (user === undefined) return <FullPageSkeleton />;
  if (!user) return <ProfileUnavailableScreen />;
  const items = NAV.filter(({ requires }) => !requires || hasRole(requires));

  return (
    <div className="flex h-screen bg-background">
      <RefreshReminder />
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar p-4 text-sidebar-foreground md:flex">
        <BrandLogo className="px-2 pb-8 pt-2" />
        <nav className="flex flex-1 flex-col gap-1">
          {items.map((item) => (
            <NavEntry key={item.label} item={item} />
          ))}
        </nav>
        <div className="space-y-3 border-t border-sidebar-border pt-4">
          <div className="px-2">
            <div className="truncate text-sm font-semibold">
              {user.name ?? user.email}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {roles
                .filter((role) => role !== KeycloakClientRole.access)
                .map((role) => (
                  <span
                    key={role}
                    className="rounded bg-sidebar-accent px-1.5 py-0.5 text-xs capitalize"
                  >
                    {role}
                  </span>
                ))}
            </div>
          </div>
          <SignInButton
            variant="ghost"
            size="sm"
            className="w-full justify-start hover:bg-sidebar-accent hover:text-sidebar-foreground"
          />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-sidebar px-4 py-3 text-sidebar-foreground md:hidden">
          <BrandLogo />
          <SignInButton
            variant="ghost"
            size="sm"
            showIcon={false}
            className="hover:bg-sidebar-accent hover:text-sidebar-foreground"
          />
        </header>
        <main className="flex-1 overflow-auto pb-20 md:pb-0">
          <RootErrorBoundary>
            <Outlet />
          </RootErrorBoundary>
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 flex border-t bg-background md:hidden">
        {items.map((item) => (
          <NavEntry key={item.label} item={item} compact />
        ))}
      </nav>
    </div>
  );
}

function FullPageSkeleton() {
  return (
    <div className="flex h-screen">
      <Skeleton className="hidden h-full w-64 rounded-none md:block" />
      <div className="flex-1 space-y-4 p-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}

export default function AppLayout() {
  return (
    <>
      <AuthLoading>
        <FullPageSkeleton />
      </AuthLoading>
      <Unauthenticated>
        <SignedOutScreen />
      </Unauthenticated>
      <Authenticated>
        <Shell />
      </Authenticated>
    </>
  );
}
