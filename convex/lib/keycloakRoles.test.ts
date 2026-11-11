import { describe, expect, it } from "vitest";
import { getKeycloakClientRoles, KeycloakClientRole } from "./keycloakRoles";

describe("getKeycloakClientRoles", () => {
  it("reads the configured custom claim", () => {
    expect(
      getKeycloakClientRoles({
        resource_access: {
          'drug-inventory': { roles: [KeycloakClientRole.access, KeycloakClientRole.admin] }
        }
      }),
    ).toEqual([KeycloakClientRole.access, KeycloakClientRole.admin]);
  });

  it("reads client roles from the standard Keycloak claim", () => {
    expect(
      getKeycloakClientRoles({
        resource_access: {
          "drug-inventory": { roles: [KeycloakClientRole.access, KeycloakClientRole.admin] },
        },
      }),
    ).toEqual([KeycloakClientRole.access, KeycloakClientRole.admin]);
  });

  it("combines, deduplicates, and filters malformed role values", () => {
    expect(
      getKeycloakClientRoles({
        resource_access: {
          "drug-inventory": { roles: [KeycloakClientRole.access, KeycloakClientRole.admin, KeycloakClientRole.access, 1] },
        },
      }),
    ).toEqual([KeycloakClientRole.access, KeycloakClientRole.admin]);
  });

  it("returns no roles for malformed or unrelated claims", () => {
    expect(getKeycloakClientRoles(null)).toEqual([]);
    expect(
      getKeycloakClientRoles({
        resource_access: {
          "drug-inventory": { roles: KeycloakClientRole.access },
        },
      })
    ).toEqual(
      [],
    );
    expect(getKeycloakClientRoles({})).toEqual([]);
  });
});
