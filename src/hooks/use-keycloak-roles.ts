import { useAuth } from "@/hooks/use-auth.ts";
import { keycloakRolesFromClaims } from "@/convex/lib/keycloakRoles.ts";

export const enum RoleCatelog {
  access = 'access',
  changes = 'changes',
  logs = 'logs',
  settings = 'settings',
  users = 'users',
  inventory_manage = 'inventory_manage',
}

export function useKeycloakRoles() {
  const { user } = useAuth();
  const roles = keycloakRolesFromClaims(user?.profile);
  return {
    roles,
    hasRole: (role: string) => roles.includes(role)
  };
}
