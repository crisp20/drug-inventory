import { ConvexError } from "convex/values";
import { env } from "../_generated/server";
import { isNumber, isRecord, isString } from "./typing";

// helpers to navigate the techincal parts of the request

function keycloakConfig() {
  const authority = new URL(env.OIDC_AUTHORITY);
  const realmMatch = /^(.*)\/realms\/([^/]+)\/?$/.exec(authority.pathname);
  if (!realmMatch) {
    throw new Error("OIDC_AUTHORITY must be a Keycloak realm URL");
  }

  const realmName = decodeURIComponent(realmMatch[2]);
  const realmUrl = `${authority.origin}${authority.pathname.replace(/\/$/, "")}`;
  const serverPath = realmMatch[1].replace(/\/$/, "");
  const adminRealmUrl = `${authority.origin}${serverPath}/admin/realms/${encodeURIComponent(realmName)}`;

  return {
    realmName, realmUrl, adminRealmUrl,
    clientUuid: env.KC_DRUG_INVENTORY_CLIENT_UUID,
    clientSecret: env.KC_BACKEND_CLIENT_SECRET,
  };
}

export async function getKeycloakServiceToken(): Promise<string> {
  const config = keycloakConfig();
  const response = await fetch(
    `${config.realmUrl}/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: "drug-inventory-backend",
        client_secret: config.clientSecret,
      }),
    },
  );

  if (!response.ok) {
    throw new ConvexError(`Requesting keycloak service token returned ${response.status} ${response.statusText}`);
  }

  const body: unknown = await response.json();
  if (!isRecord(body) || typeof body.access_token !== "string") {
    throw new ConvexError("Keycloak service token response did not include a token");
  }
  return body.access_token;
}

export async function keycloakRequest(
  token: string,
  path: string,
  init: RequestInit = {},
  expectedStatus: number = 200,
): Promise<Response> {
  const config = keycloakConfig();
  const url = `${config.adminRealmUrl}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });

  if (response.status != expectedStatus) {
    throw new ConvexError(`${url} returned HTTP status ${response.status}, expected HTTP status ${expectedStatus}`);
  }

  return response;
}

// business logic requests

export interface RoleGroup {
  id: string,
  path: string,
  clientRoles: string[],
  members: string[],
}

export async function getKeycloakRoleGroups(token: string): Promise<RoleGroup[]> {
  const clientName = 'drug-inventory';

  async function getClientRoles(fullPath: string): Promise<RoleGroup[]> {
    const result: RoleGroup[] = [];

    const { id, path, subGroupCount, clientRoles } = await Promise.resolve()
      .then(() => keycloakRequest(token, `/group-by-path${fullPath}`))
      .then((response) => response.json())
      .then((response) => {
        if (!isRecord(response)) {
          throw new ConvexError(`'/group-by-path${fullPath}' returned an invalid response`);
        }
        const { id, path, subGroupCount, clientRoles } = response;
        if (!isString(id) || !isString(path) || !isNumber(subGroupCount)) {
          throw new ConvexError(`'/group-by-path${fullPath}' returned an invalid response`);
        }

        if (!isRecord(clientRoles) || !Array.isArray(clientRoles[clientName]) || !clientRoles[clientName].every(isString)) {
          throw new ConvexError(`'/group-by-path${fullPath}' returned an invalid response`);
        }
        return { id, path, subGroupCount, clientRoles: clientRoles[clientName] };
      })

    const members = await getKeycloakGroupMembers(token, id);
    const roleGroup: RoleGroup = { id, path, clientRoles, members };

    if (subGroupCount > 0) {
      await Promise.resolve()
        .then(() => keycloakRequest(token, `/groups/${encodeURIComponent(id)}/children`))
        .then((response) => response.json())
        .then((response) => {
          if (!Array.isArray(response) || !response.every(isRecord)) {
            throw new ConvexError(`'/groups/${id}/children' returned an invalid response`);
          }
          const children = response.map(({ path }) => path);
          if (!children.every(isString)) {
            throw new ConvexError(`'/groups/${id}/children' returned an invalid response`);
          }
          return children;
        })
        .then((children) => Promise.allSettled(children.map(async path => await getClientRoles(path))))
        .then((children) => {
          const failures = children.filter((r): r is PromiseRejectedResult => r.status === "rejected");
          if (children.filter((r): r is PromiseRejectedResult => r.status === "rejected").length > 0) {
            throw new ConvexError(`Failed to load children data: ${failures.map((f) => String(f.reason)).join("; ")}`)
          }
          return children.filter((r): r is PromiseFulfilledResult<RoleGroup[]> => r.status == 'fulfilled').flatMap(({ value }) => value)
        })
        .then((roles) => {
          roleGroup.members.push(...roles.flatMap(({ members }) => members))
          roleGroup.members = roleGroup.members.filter((e1, index) => roleGroup.members.findIndex(e2 => e1 == e2) == index);
          result.push(...roles);
        })
    }

    result.push(roleGroup);

    return result;
  }

  const topLevelFullPath = '/drug-inventory-users';
  return getClientRoles(topLevelFullPath);
}

export async function getKeycloakGroupMembers(token: string, groupId: string): Promise<string[]> {
  const members: string[] = [];
  const pageSize = 1000;

  for (let first = 0; ; first += pageSize) {
    const response = await keycloakRequest(token, `/groups/${encodeURIComponent(groupId)}/members?first=${first}&max=${pageSize}`)
      .then((response) => response.json());
    if (!Array.isArray(response)) {
      throw new ConvexError(`'/groups/${groupId}/members' returned an invalid response`);
    }

    const page = response
      .filter(isRecord)
      .map(({ id }) => id)
      .filter((id): id is string => isString(id));

    members.push(...page);

    if (page.length < pageSize) {
      break;
    };
  }

  return members;
}

export async function setKeycloakUserGroupMembership(token: string, userId: string, groupId: string, isMember: boolean): Promise<void> {
  await keycloakRequest(
    token,
    `/users/${encodeURIComponent(userId)}/groups/${encodeURIComponent(groupId)}`,
    {
      method: isMember ? 'PUT' : 'DELETE'
    },
    204
  );
}
