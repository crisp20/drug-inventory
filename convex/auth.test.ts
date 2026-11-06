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
  DIRECTOR_USERNAME: "admin@example.com",
  DIRECTOR_PASSWORD: "Admin-123A!",
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
    params: {
      flow: "signUp",
      email: username,
      password,
      confirmPassword: password,
      ...extraParams,
    },
  });
}

describe("username and password authentication", () => {
  it("activates only the configured admin and leaves other registrations pending", async () => {
    const t = convexTest(schema, modules);

    await signUp(t, "admin@example.com", authEnvironment.DIRECTOR_PASSWORD);
    await signUp(t, "staff@example.com", "Staff-1234A!", {
      role: "admin",
    });
    await t.action(signIn, {
      provider: "password",
      params: {
        flow: "signIn",
        email: "staff@example.com",
        password: "Staff-1234A!",
      },
    });

    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          email: "admin@example.com",
          role: "admin",
          status: "active",
        }),
        expect.objectContaining({
          email: "staff@example.com",
          role: "staff",
          status: "pending",
        }),
      ]),
    );

    const admin = users.find((user) => user.role === "admin");
    const staff = users.find((user) => user.email === "staff@example.com");
    if (!admin || !staff) {
      throw new Error("The expected accounts were not created");
    }

    const adminClient = t.withIdentity({
      subject: admin._id,
      tokenIdentifier: admin._id,
    });
    await adminClient.mutation(api.users.updateAccess, {
      userId: staff._id,
      status: "active",
    });
    await expect(
      adminClient.mutation(api.users.updateAccess, {
        userId: admin._id,
        status: "disabled",
      }),
    ).rejects.toThrow(/admin account cannot be changed/i);
    await expect(
      t
        .withIdentity({
          subject: staff._id,
          tokenIdentifier: staff._id,
        })
        .query(api.drugs.search, { term: "x" }),
    ).resolves.toEqual([]);
  });

  it("does not allow another account to claim the configured admin username", async () => {
    const t = convexTest(schema, modules);

    await expect(
      signUp(t, "admin@example.com", "Wrong-1234A!Pass"),
    ).rejects.toThrow(/Invalid admin credentials/);

    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users).toHaveLength(0);
  });

  it("requires matching signup passwords", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.action(signIn, {
        provider: "password",
        params: {
          flow: "signUp",
          email: "staff@example.com",
          password: "Staff-1234A!",
          confirmPassword: "Other-1234A!",
        },
      }),
    ).rejects.toThrow(/Passwords do not match/);
    await expect(
      t.run((ctx) => ctx.db.query("users").collect()),
    ).resolves.toHaveLength(0);
  });

  it("lets a admin reset another user's password and lets the user reset their own", async () => {
    const t = convexTest(schema, modules);
    await signUp(t, "admin@example.com", authEnvironment.DIRECTOR_PASSWORD);
    await signUp(t, "staff@example.com", "Staff-1234A!");

    const users = await t.run((ctx) => ctx.db.query("users").collect());
    const admin = users.find((user) => user.role === "admin");
    const staff = users.find((user) => user.email === "staff@example.com");
    if (!admin || !staff) {
      throw new Error("The expected accounts were not created");
    }

    const adminClient = t.withIdentity({
      subject: admin._id,
      tokenIdentifier: admin._id,
    });
    await adminClient.mutation(api.users.updateAccess, {
      userId: staff._id,
      status: "active",
    });
    await adminClient.action(api.users.resetPassword, {
      userId: staff._id,
      newPassword: "Reset-1234A!",
    });
    await t.action(signIn, {
      provider: "password",
      params: {
        flow: "signIn",
        email: "staff@example.com",
        password: "Reset-1234A!",
      },
    });

    const staffClient = t.withIdentity({
      subject: staff._id,
      tokenIdentifier: staff._id,
    });
    await expect(
      staffClient.action(api.users.resetPassword, {
        userId: admin._id,
        newPassword: "BadReset-123A!",
      }),
    ).rejects.toThrow(/Only the admin can reset another user's password/);
    await staffClient.action(api.users.resetPassword, {
      newPassword: "SelfReset-123A!",
    });
    await expect(
      t.action(signIn, {
        provider: "password",
        params: {
          flow: "signIn",
          email: "staff@example.com",
          password: "Reset-1234A!",
        },
      }),
    ).rejects.toThrow(/InvalidSecret/);
    await t.action(signIn, {
      provider: "password",
      params: {
        flow: "signIn",
        email: "staff@example.com",
        password: "SelfReset-123A!",
      },
    });
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

    await signUp(t, "staff@example.com", "Staff-1234A!");

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
