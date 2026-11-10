import { describe, expect, it } from "vitest";
import { keycloakRolesFromClaims } from "./keycloakRoles";

describe("keycloakRolesFromClaims", () => {
  it("reads the configured custom claim", () => {
    expect(
      keycloakRolesFromClaims({ drug_inventory_roles: ["access", "admin"] }),
    ).toEqual(["access", "admin"]);
  });

  it("reads client roles from the standard Keycloak claim", () => {
    expect(
      keycloakRolesFromClaims({
        resource_access: {
          "drug-inventory": { roles: ["access", "admin"] },
        },
      }),
    ).toEqual(["access", "admin"]);
  });

  it("combines, deduplicates, and filters malformed role values", () => {
    expect(
      keycloakRolesFromClaims({
        drug_inventory_roles: ["access", 1],
        resource_access: {
          "drug-inventory": { roles: ["access", "admin"] },
        },
      }),
    ).toEqual(["access", "admin"]);
  });

  it("returns no roles for malformed or unrelated claims", () => {
    expect(keycloakRolesFromClaims(null)).toEqual([]);
    expect(keycloakRolesFromClaims({ drug_inventory_roles: "admin" })).toEqual(
      [],
    );
    expect(keycloakRolesFromClaims({})).toEqual([]);
  });
});
