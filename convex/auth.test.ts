/* eslint-disable @convex-dev/no-process-env */
import { createPublicKey, generateKeyPairSync } from "node:crypto";
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { modules } from "./test.setup";
import schema from "./schema";

const signIn = makeFunctionReference<"action">("auth:signIn");
const previousEnvironment = new Map<string, string | undefined>();
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const jwk = createPublicKey(publicKey).export({ format: "jwk" });
const authEnvironment = {
  CONVEX_SITE_URL: "http://localhost:3211",
  JWT_PRIVATE_KEY: privateKey,
  JWKS: JSON.stringify({
    keys: [{ ...jwk, kid: "auth-test", alg: "RS256", use: "sig" }],
  }),
  DIRECTOR_USERNAME: "director@example.com",
  DIRECTOR_PASSWORD: "director-test-password-2026",
};

beforeEach(() => {
  for (const [name, value] of Object.entries(authEnvironment)) {
    previousEnvironment.set(name, process.env[name]);
    process.env[name] = value;
  }
});

afterEach(() => {
  for (const [name, value] of previousEnvironment) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  previousEnvironment.clear();
});

async function signUp(
  t: ReturnType<typeof convexTest>,
  username: string,
  password: string,
  extraParams: Record<string, string> = {},
) {
  return await t.action(signIn, {
    provider: "password",
    params: { flow: "signUp", email: username, password, ...extraParams },
  });
}

describe("username and password authentication", () => {
  it("activates only the configured Director and leaves other registrations pending", async () => {
    const t = convexTest(schema, modules);

    await signUp(t, "director@example.com", authEnvironment.DIRECTOR_PASSWORD);
    await signUp(t, "staff@example.com", "staff-test-password-2026", {
      role: "director",
    });
    await t.action(signIn, {
      provider: "password",
      params: {
        flow: "signIn",
        email: "staff@example.com",
        password: "staff-test-password-2026",
      },
    });

    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          email: "director@example.com",
          role: "director",
          status: "active",
        }),
        expect.objectContaining({
          email: "staff@example.com",
          role: "staff",
          status: "pending",
        }),
      ]),
    );

    const director = users.find((user) => user.role === "director");
    const staff = users.find((user) => user.email === "staff@example.com");
    if (!director || !staff) {
      throw new Error("The expected accounts were not created");
    }

    const directorClient = t.withIdentity({
      subject: director._id,
      tokenIdentifier: director._id,
    });
    await directorClient.mutation(api.users.updateAccess, {
      userId: staff._id,
      status: "active",
    });
    await expect(
      directorClient.mutation(api.users.updateAccess, {
        userId: director._id,
        status: "disabled",
      }),
    ).rejects.toThrow(/director account cannot be changed/i);
    await expect(
      t
        .withIdentity({
          subject: staff._id,
          tokenIdentifier: staff._id,
        })
        .query(api.drugs.search, { term: "x" }),
    ).resolves.toEqual([]);
  });

  it("does not allow another account to claim the configured Director username", async () => {
    const t = convexTest(schema, modules);

    await expect(
      signUp(t, "director@example.com", "wrong-director-password"),
    ).rejects.toThrow(/Invalid director credentials/);

    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users).toHaveLength(0);
  });

  it("reuses legacy accounts but requires approval and does not preserve old admin access", async () => {
    const t = convexTest(schema, modules);
    const legacyUserId = await t.run((ctx) =>
      ctx.db.insert("users", {
        email: "Staff@Example.com",
        name: "Existing Staff",
        role: "admin",
        status: "active",
        tokenIdentifier: "legacy|staff",
      }),
    );

    await signUp(t, "staff@example.com", "staff-test-password-2026");

    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      _id: legacyUserId,
      email: "staff@example.com",
      role: "staff",
      status: "pending",
    });
  });
});
