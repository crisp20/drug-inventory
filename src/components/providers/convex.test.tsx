import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConvexProvider } from "./convex.tsx";

const mocks = vi.hoisted(() => ({
  oidcAuth: {
    isLoading: false,
    isAuthenticated: true,
    user: { id_token: "initial-id-token" as string | undefined },
    signinSilent: vi.fn<() => Promise<{ id_token: string }>>(),
  },
  fetchAccessToken: undefined as
    | ((args: { forceRefreshToken: boolean }) => Promise<string | null>)
    | undefined,
}));

vi.mock("react-oidc-context", () => ({
  useAuth: () => mocks.oidcAuth,
}));

vi.mock("convex/react", () => ({
  ConvexReactClient: class {},
  ConvexProviderWithAuth: ({
    children,
    useAuth,
  }: {
    children: React.ReactNode;
    useAuth: () => {
      fetchAccessToken: (args: {
        forceRefreshToken: boolean;
      }) => Promise<string | null>;
    };
  }) => {
    mocks.fetchAccessToken = useAuth().fetchAccessToken;
    return children;
  },
}));

describe("ConvexProvider", () => {
  beforeEach(() => {
    mocks.oidcAuth.user = { id_token: "initial-id-token" };
    mocks.oidcAuth.signinSilent
      .mockReset()
      .mockResolvedValue({ id_token: "refreshed-id-token" });
    mocks.fetchAccessToken = undefined;
  });

  it("keeps the token fetcher stable as the OIDC user is refreshed", async () => {
    const { rerender } = render(
      <ConvexProvider>
        <div />
      </ConvexProvider>,
    );
    const initialFetcher = mocks.fetchAccessToken;
    expect(initialFetcher).toBeDefined();
    await expect(initialFetcher?.({ forceRefreshToken: false })).resolves.toBe(
      "initial-id-token",
    );

    mocks.oidcAuth.user = { id_token: "latest-id-token" };
    rerender(
      <ConvexProvider>
        <div />
      </ConvexProvider>,
    );

    expect(mocks.fetchAccessToken).toBe(initialFetcher);
    await expect(initialFetcher?.({ forceRefreshToken: false })).resolves.toBe(
      "latest-id-token",
    );
    await expect(initialFetcher?.({ forceRefreshToken: true })).resolves.toBe(
      "refreshed-id-token",
    );
    expect(mocks.oidcAuth.signinSilent).toHaveBeenCalledOnce();
  });
});
