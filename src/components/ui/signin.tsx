import { forwardRef, useState } from "react";
import { type VariantProps } from "class-variance-authority";
import { Loader2, LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { Button, buttonVariants } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";

export interface SignInButtonProps
  extends
    Omit<React.ComponentProps<"button">, "onClick">,
    VariantProps<typeof buttonVariants> {
  /**
   * Custom onClick handler that runs before authentication action
   */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /**
   * Whether to show icons in the button
   * @default true
   */
  showIcon?: boolean;
  /**
   * Custom text for sign in state
   * @default "Sign In"
   */
  signInText?: string;
  /**
   * Custom text for sign out state
   * @default "Sign Out"
   */
  signOutText?: string;
  /**
   * Custom text for loading state
   * @default "Signing In..." or "Signing Out..."
   */
  loadingText?: string;
  /**
   * Whether to use the asChild pattern
   * @default false
   */
  asChild?: boolean;
}

/**
 * A button component that handles authentication sign in/out with proper loading states
 * and accessibility features.
 */
export const SignInButton = forwardRef<HTMLButtonElement, SignInButtonProps>(
  (
    {
      onClick,
      disabled,
      showIcon = true,
      signInText = "Sign In",
      signOutText = "Sign Out",
      loadingText,
      className,
      variant,
      size,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const { isAuthenticated, isLoading } = useConvexAuth();
    const { signIn, signOut } = useAuthActions();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [signingIn, setSigningIn] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);

    const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (event.defaultPrevented) return;
      if (!isAuthenticated) {
        setDialogOpen(true);
        return;
      }

      try {
        await signOut();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not sign out",
        );
      }
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSigningIn(true);
      try {
        const formData = new FormData(event.currentTarget);
        formData.set("flow", isSignUp ? "signUp" : "signIn");
        await signIn("password", formData);
        setDialogOpen(false);
        toast.success(isSignUp ? "Account created" : "Signed in");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not sign in",
        );
      } finally {
        setSigningIn(false);
      }
    };

    const isDisabled = disabled || isLoading || signingIn;
    const buttonText = isLoading
      ? (loadingText ?? (isAuthenticated ? "Signing Out..." : "Signing In..."))
      : isAuthenticated
        ? signOutText
        : signInText;

    const icon = isLoading ? (
      <Loader2 className="size-4 animate-spin" />
    ) : isAuthenticated ? (
      <LogOut className="size-4" />
    ) : (
      <LogIn className="size-4" />
    );

    return (
      <>
        <Button
          ref={ref}
          onClick={(event) => void handleClick(event)}
          disabled={isDisabled}
          variant={variant}
          size={size}
          className={className}
          asChild={asChild}
          aria-label={
            isAuthenticated
              ? "Sign out of your account"
              : "Sign in to your account"
          }
          {...props}
        >
          {showIcon && icon}
          {buttonText}
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {isSignUp ? "Create an account" : "Sign in"}
              </DialogTitle>
              <DialogDescription>
                Usernames must be in email format. No email is sent. The
                configured Director account is activated automatically; all
                other new accounts need Director approval.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(event) => void handleSubmit(event)}
              className="space-y-4"
            >
              {isSignUp && (
                <div className="space-y-2">
                  <label htmlFor="auth-name" className="text-sm font-medium">
                    Name
                  </label>
                  <Input
                    id="auth-name"
                    name="name"
                    autoComplete="name"
                    maxLength={80}
                  />
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="auth-email" className="text-sm font-medium">
                  Username
                </label>
                <Input
                  id="auth-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="auth-password" className="text-sm font-medium">
                  Password
                </label>
                <Input
                  id="auth-password"
                  name="password"
                  type="password"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  minLength={isSignUp ? 12 : undefined}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={signingIn}>
                {signingIn && <Loader2 className="size-4 animate-spin" />}
                {signingIn
                  ? "Please wait..."
                  : isSignUp
                    ? "Create account"
                    : "Sign in"}
              </Button>
            </form>
            <p className="text-center text-sm text-muted-foreground">
              {isSignUp ? "Already have an account?" : "Need an account?"}{" "}
              <button
                type="button"
                className="font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => setIsSignUp((current) => !current)}
              >
                {isSignUp ? "Sign in" : "Create account"}
              </button>
            </p>
          </DialogContent>
        </Dialog>
      </>
    );
  },
);

SignInButton.displayName = "SignInButton";
