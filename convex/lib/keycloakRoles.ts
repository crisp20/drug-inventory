function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getKeycloakClientRoles(claims: unknown): string[] {
  const key = 'clientRoles';
  if (!isRecord(claims)) {
    return [];
  }
  if (!Array.isArray(claims[key])) {
    return [];
  }
  const uniqueRoles = [...new Set(claims[key].filter((role): role is string => typeof role === 'string'))];
  return uniqueRoles;
}

export const enum KeycloakClientRole {
  access = 'access',
  admin = 'admin',
  changes = 'changes',
  logs = 'logs',
  settings = 'settings',
  users = 'users',
  inventory_manage = 'inventory_manage',
}
