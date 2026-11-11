import { action, internalAction } from "./_generated/server";
import { getKeycloakRoleGroups, getKeycloakServiceToken } from "./lib/keycloak";

export const getManagedGroupsAndMembers = action({
  args: {},
  handler: async () => {
    const token = await getKeycloakServiceToken();
    const roleGroups = await getKeycloakRoleGroups(token);

    return {
      roleGroups,
    };
  }
})