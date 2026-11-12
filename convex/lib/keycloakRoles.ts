import { isRecord, isString } from "./typing";

export function getKeycloakClientRoles(claims: unknown): string[] {
  const key = 'clientRoles';
  if (!isRecord(claims)) {
    return [];
  }
  if (!Array.isArray(claims[key])) {
    return [];
  }
  const uniqueRoles = [...new Set(claims[key].filter(isString))];
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

export function authorityRank(role: string): number {
  switch (role) {
    case `${KeycloakClientRole.admin}`:
      return 2;
    case `${KeycloakClientRole.users}`:
      return 1;
    default:
      return 0;
  }
}