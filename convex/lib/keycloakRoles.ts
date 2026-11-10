type Claims = Record<string, unknown>;

function isRecord(value: unknown): value is Claims {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function keycloakRolesFromClaims(claims: unknown): string[] {
  if (!isRecord(claims)) return [];

  const customRoles = Array.isArray(claims.drug_inventory_roles)
    ? claims.drug_inventory_roles.filter(
        (role): role is string => typeof role === "string",
      )
    : [];
  const resourceAccess = isRecord(claims.resource_access)
    ? claims.resource_access
    : undefined;
  const clientRoles =
    resourceAccess && isRecord(resourceAccess["drug-inventory"])
      ? resourceAccess["drug-inventory"].roles
      : undefined;
  const tokenRoles = Array.isArray(clientRoles)
    ? clientRoles.filter((role): role is string => typeof role === "string")
    : [];

  return [...new Set([...customRoles, ...tokenRoles])];
}
