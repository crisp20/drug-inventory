import { useAuth } from "@/hooks/use-auth.ts";
import { getKeycloakClientRoles, type KeycloakClientRole } from "@/convex/lib/keycloakRoles.ts";

export function useKeycloakRoles() {
  const { user } = useAuth();
  const roles = getKeycloakClientRoles(user?.profile);
  return {
    roles,
    hasRole: (role: `${KeycloakClientRole}`) => roles.includes(role)
  };
}
