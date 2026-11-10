import { useAuth } from "@/hooks/use-auth.ts";
import { keycloakRolesFromClaims } from "@/convex/lib/keycloakRoles.ts";

export function useKeycloakRoles() {
  const { user } = useAuth();
  const roles = keycloakRolesFromClaims(user?.profile);
  return {
    roles,
    hasAccess: roles.includes("access"),
    isAdmin: roles.includes("admin"),
  };
}
