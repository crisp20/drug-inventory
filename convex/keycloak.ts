import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { getKeycloakRoleGroups, getKeycloakServiceToken, setKeycloakUserGroupMembership } from "./lib/keycloak";

export const getManagedGroupsAndMembers = action({
  args: {},
  handler: async (ctx) => {
    const token = await getKeycloakServiceToken();
    const roleGroups = await getKeycloakRoleGroups(token);

    return {
      roleGroups,
    };
  }
})

export const setUserGroupMembership = action({
  args: {
    isMember: v.boolean(),
    userId: v.string(),
    groupId: v.string(),
  },
  handler: async (ctx, { userId, groupId, isMember }) => {
    // TODO - this user has more authority than self, not allowed to modify

    // TODO - this user is self, not allowed to modify

    // TODO - this role has more authority than self, not allowed to modify

    const token = await getKeycloakServiceToken();
    await setKeycloakUserGroupMembership(
      token,
      userId,
      groupId,
      isMember
    )
  }
})