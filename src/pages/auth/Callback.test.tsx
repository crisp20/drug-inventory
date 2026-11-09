import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthCallback from "./Callback.tsx";
import { authCallbackMessages } from "./callback-messages.ts";

const mocks = vi.hoisted(() => ({
  auth: {
    isAuthenticated: false,
    isLoading: true,
    error: null as Error | null,
    user: { state: undefined as unknown },
    signin: vi.fn<() => Promise<void>>(),
  },
  convexAuth: {
    isLoading: true,
    isAuthenticated: false,
  },
  updateCurrentUser: vi.fn<() => Promise<null>>(),
}));

vi.mock("@/hooks/use-auth.ts", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => mocks.convexAuth,
  useMutation: () => mocks.updateCurrentUser,
}));

function CallbackRoutes(
  props: React.ComponentProps<typeof AuthCallback>,
): React.JSX.Element {
  return (
    <MemoryRouter initialEntries={["/auth/callback"]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback {...props} />} />
        <Route path="/" element={<div>App home</div>} />
        <Route path="/notes/:id" element={<div>Note page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mocks.auth.isAuthenticated = false;
  mocks.auth.isLoading = true;
  mocks.auth.error = null;
  mocks.auth.user.state = undefined;
  mocks.convexAuth.isLoading = true;
  mocks.convexAuth.isAuthenticated = false;
  mocks.auth.signin.mockReset().mockResolvedValue(undefined);
  mocks.updateCurrentUser.mockReset().mockResolvedValue(null);
});

describe("AuthCallback", () => {
  it.each([
    { messages: undefined, loading: "Loading..." },
    { messages: {}, loading: "Loading..." },
    { messages: { loading: undefined }, loading: "Loading..." },
    { messages: { loading: "Signing in..." }, loading: "Signing in..." },
    { messages: authCallbackMessages.de, loading: "Wird geladen..." },
  ])(
    "localizes loading text and its accessible label: $loading",
    ({ messages, loading }) => {
      render(<CallbackRoutes messages={messages} />);

      expect(screen.getByText(loading)).toBeInTheDocument();
      expect(screen.getByRole("status", { name: loading })).toBeInTheDocument();
      expect(mocks.updateCurrentUser).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      messages: undefined,
      title: "Something went wrong",
      guidance: /reopen the original link in your browser/,
      home: "Return home",
      retry: "Try again",
    },
    {
      messages: { tryAgain: "Retry sign-in" },
      title: "Something went wrong",
      guidance: /reopen the original link in your browser/,
      home: "Return home",
      retry: "Retry sign-in",
    },
    {
      messages: authCallbackMessages.de,
      title: "Etwas ist schiefgelaufen",
      guidance: /ursprünglichen Link erneut in Ihrem Browser/,
      home: "Zur Startseite",
      retry: "Erneut versuchen",
    },
  ])(
    "explains missing browser state: $title",
    ({ messages, title, guidance, home, retry }) => {
      mocks.auth.isLoading = false;
      mocks.auth.error = new Error("No matching state found in storage");

      render(<CallbackRoutes messages={messages} />);

      expect(screen.getByText(title)).toBeInTheDocument();
      expect(screen.getByText(guidance)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: home })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: retry })).toBeInTheDocument();
      expect(
        screen.queryByText("No matching state found in storage"),
      ).not.toBeInTheDocument();
      expect(mocks.updateCurrentUser).not.toHaveBeenCalled();
    },
  );

  it("shows OIDC errors and retries sign-in", async () => {
    const user = userEvent.setup();
    mocks.auth.isLoading = false;
    mocks.auth.error = new Error("Keycloak login failed");

    render(<CallbackRoutes />);

    expect(screen.getByText("Keycloak login failed")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(mocks.auth.signin).toHaveBeenCalledWith("/");
  });

  it("syncs the authenticated user and returns to the original page", async () => {
    mocks.auth.isLoading = false;
    mocks.auth.isAuthenticated = true;
    mocks.auth.user.state = { returnTo: "/notes/42?tab=edit" };
    mocks.convexAuth.isLoading = false;
    mocks.convexAuth.isAuthenticated = true;

    render(<CallbackRoutes />);

    await waitFor(() =>
      expect(mocks.updateCurrentUser).toHaveBeenCalledOnce(),
    );
    expect(await screen.findByText("Note page")).toBeInTheDocument();
  });

  it.each([
    "https://evil.example/notes/1",
    "//evil.example/notes/1",
    "/\\evil.example",
    "/auth/callback?code=x",
    42,
  ])("returns home instead of following unsafe return state: %s", async (to) => {
    mocks.auth.isLoading = false;
    mocks.auth.isAuthenticated = true;
    mocks.auth.user.state = { returnTo: to };
    mocks.convexAuth.isLoading = false;
    mocks.convexAuth.isAuthenticated = true;

    render(<CallbackRoutes />);

    expect(await screen.findByText("App home")).toBeInTheDocument();
  });

  it("shows an error when the Convex user sync fails", async () => {
    mocks.auth.isLoading = false;
    mocks.auth.isAuthenticated = true;
    mocks.convexAuth.isLoading = false;
    mocks.convexAuth.isAuthenticated = true;
    mocks.updateCurrentUser.mockRejectedValueOnce(
      new Error("Could not verify the identity with Convex"),
    );

    render(<CallbackRoutes />);

    expect(
      await screen.findByText("Could not verify the identity with Convex"),
    ).toBeInTheDocument();
  });

  it("navigates home when callback is opened without an OIDC session", async () => {
    mocks.auth.isLoading = false;

    render(<CallbackRoutes />);

    expect(await screen.findByText("App home")).toBeInTheDocument();
    expect(mocks.updateCurrentUser).not.toHaveBeenCalled();
  });

  it("waits for Convex to confirm the Keycloak token before syncing the user", async () => {
    mocks.auth.isLoading = false;
    mocks.auth.isAuthenticated = true;
    const { rerender } = render(<CallbackRoutes />);

    expect(mocks.updateCurrentUser).not.toHaveBeenCalled();

    mocks.convexAuth.isLoading = false;
    mocks.convexAuth.isAuthenticated = true;
    rerender(<CallbackRoutes />);

    await waitFor(() =>
      expect(mocks.updateCurrentUser).toHaveBeenCalledOnce(),
    );
  });

  it("explains when Convex rejects the Keycloak token", async () => {
    mocks.auth.isLoading = false;
    mocks.auth.isAuthenticated = true;
    mocks.convexAuth.isLoading = false;
    mocks.convexAuth.isAuthenticated = false;

    render(<CallbackRoutes />);

    expect(
      await screen.findByText(
        "Convex could not verify your Keycloak sign-in. Check the configured OIDC issuer and client audience.",
      ),
    ).toBeInTheDocument();
    expect(mocks.updateCurrentUser).not.toHaveBeenCalled();
  });

  it("shows guidance if Convex never finishes verifying the token", async () => {
    mocks.auth.isLoading = false;
    mocks.auth.isAuthenticated = true;
    vi.useFakeTimers();
    try {
      render(<CallbackRoutes />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000);
      });

      expect(
        screen.getByText(
          "Convex is still verifying your Keycloak token. Check its connection and the configured OIDC issuer and client audience.",
        ),
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
