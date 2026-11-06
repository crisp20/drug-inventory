import { forwardRef, useEffect, useState } from "react";
import { type VariantProps } from "class-variance-authority";
import { CircleAlertIcon, CircleCheckIcon, Eye, EyeOff, Loader2, LogIn, LogOut } from "lucide-react";
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
import {
  hasOnlyAllowedPasswordCharacters,
  hasSpecialPasswordCharacter,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  PASSWORD_REQUIREMENTS_MESSAGE,
  validatePasswordRequirements,
} from "@/convex/lib/password.ts";
import { signInErrorMessage, signUpErrorMessage } from "@/lib/auth-errors.ts";
import { isValidUsername, MAX_USERNAME_LENGTH } from "@/convex/lib/username.ts";

function showAuthError(message: string) {
  toast.error(message, { position: "top-center", richColors: true });
}

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
    const [showPassword, setShowPassword] = useState(false);
    const [credentials, setCredentials] = useState({ username: '', password: '', confirmPassword: '' });

    useEffect(() => {
      function resetPopup() {
        setCredentials({ username: '', password: '', confirmPassword: '' });
        setShowPassword(false);
        setIsSignUp(false);
      }
      if (!dialogOpen) {
        resetPopup();
      }
    }, [dialogOpen])

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
        showAuthError(
          error instanceof Error ? error.message : "Could not sign out",
        );
      }
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const username = formData.get("email");
      if (typeof username !== "string" || !username.trim()) {
        showAuthError("Enter a username in email format");
        return;
      }
      if (!isValidUsername(username)) {
        showAuthError("Enter a valid username in email format");
        return;
      }
      const password = formData.get("password");
      if (typeof password !== "string" || !password) {
        showAuthError("Enter a password");
        return;
      }
      if (isSignUp) {
        try {
          validatePasswordRequirements(password);
        } catch (error) {
          showAuthError(
            error instanceof Error
              ? error.message
              : PASSWORD_REQUIREMENTS_MESSAGE,
          );
          return;
        }
        if (formData.get("confirmPassword") !== password) {
          showAuthError("Passwords do not match");
          return;
        }
        const name = formData.get("name");
        if (typeof name === "string" && name.length > 80) {
          showAuthError("Name is too long");
          return;
        }
      }
      setSigningIn(true);
      try {
        formData.set("flow", isSignUp ? "signUp" : "signIn");
        await signIn("password", formData);
        setDialogOpen(false);
        toast.success(isSignUp ? "Account created" : "Signed in");
      } catch (error) {
        showAuthError(
          isSignUp
            ? signUpErrorMessage(error)
            : signInErrorMessage(error),
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
              {
                isSignUp &&
                <DialogDescription>
                  New accounts need admin approval.
                </DialogDescription>
              }
            </DialogHeader>
            <form
              onSubmit={(event) => void handleSubmit(event)}
              className="space-y-4"
              noValidate
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
                  maxLength={MAX_USERNAME_LENGTH}
                  required
                  onChange={(e) => setCredentials({ ...credentials, username: e.currentTarget.value })}
                />
                {
                  isSignUp &&
                  <>
                    <div className="flex space-x-2 items-center">
                      {
                        isValidUsername(credentials.username) ?
                          <CircleCheckIcon color="green" /> :
                          <CircleAlertIcon color="red" />
                      }
                      <span className="text-sm text-muted-foreground">Username must be in email format</span>
                    </div>
                  </>
                }
              </div>
              <div className="space-y-2">
                <label htmlFor="auth-password" className="text-sm font-medium">
                  Password
                </label>
                <div className="relative">
                  <Input
                    id="auth-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={
                      isSignUp ? "new-password" : "current-password"
                    }
                    minLength={isSignUp ? MIN_PASSWORD_LENGTH : undefined}
                    maxLength={isSignUp ? MAX_PASSWORD_LENGTH : undefined}
                    className="pr-10"
                    required
                    onChange={(e) => setCredentials({ ...credentials, password: e.currentTarget.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className="absolute top-0 right-0 h-full aspect-square"
                    onClick={() => setShowPassword((shown) => !shown)}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
                {
                  isSignUp &&
                  <>
                    <div className="flex space-x-2 items-center">
                      {
                        hasOnlyAllowedPasswordCharacters(credentials.password) ?
                          <CircleCheckIcon color="green" /> :
                          <CircleAlertIcon color="red" />
                      }
                      <span className="text-sm text-muted-foreground">Use only English letters, numbers, and standard special characters (no spaces)</span>
                    </div>
                    <div className="flex space-x-2 items-center">
                      {
                        (MIN_PASSWORD_LENGTH <= credentials.password?.length && credentials.password?.length <= MAX_PASSWORD_LENGTH) ?
                          <CircleCheckIcon color="green" /> :
                          <CircleAlertIcon color="red" />
                      }
                      <span className="text-sm text-muted-foreground">Between {MIN_PASSWORD_LENGTH} and {MAX_PASSWORD_LENGTH} characters long</span>
                    </div>
                    <div className="flex space-x-2 items-center">
                      {
                        /[A-Z]/.test(credentials.password) ?
                          <CircleCheckIcon color="green" /> :
                          <CircleAlertIcon color="red" />
                      }
                      <span className="text-sm text-muted-foreground">Include at least one upper case letter</span>
                    </div>
                    <div className="flex space-x-2 items-center">
                      {
                        /[a-z]/.test(credentials.password) ?
                          <CircleCheckIcon color="green" /> :
                          <CircleAlertIcon color="red" />
                      }
                      <span className="text-sm text-muted-foreground">Include at least one lower case letter</span>
                    </div>
                    <div className="flex space-x-2 items-center">
                      {
                        hasSpecialPasswordCharacter(credentials.password) ?
                          <CircleCheckIcon color="green" /> :
                          <CircleAlertIcon color="red" />
                      }
                      <span className="text-sm text-muted-foreground">Include at least one special character</span>
                    </div>
                    <div className="flex space-x-2 items-center">
                      {
                        /\d/.test(credentials.password) ?
                          <CircleCheckIcon color="green" /> :
                          <CircleAlertIcon color="red" />
                      }
                      <span className="text-sm text-muted-foreground">Include at least one digit</span>
                    </div>
                  </>
                }
              </div>
              {isSignUp && (
                <div className="space-y-2">
                  <label
                    htmlFor="auth-confirm-password"
                    className="text-sm font-medium"
                  >
                    Confirm password
                  </label>
                  <div className="relative">
                    <Input
                      id="auth-confirm-password"
                      name="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={MIN_PASSWORD_LENGTH}
                      maxLength={MAX_PASSWORD_LENGTH}
                      required
                      onChange={(e) => setCredentials({ ...credentials, confirmPassword: e.currentTarget.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      className="absolute top-0 right-0 h-full aspect-square"
                      onClick={() => setShowPassword((shown) => !shown)}
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
                    </Button>
                  </div>
                </div>
              )}
              {
                isSignUp &&
                <>
                  <div className="flex space-x-2 items-center">
                    {
                      credentials.confirmPassword != '' && credentials.password == credentials.confirmPassword ?
                        <CircleCheckIcon color="green" /> :
                        <CircleAlertIcon color="red" />
                    }
                    <span className="text-sm text-muted-foreground">Passwords must match</span>
                  </div>
                </>
              }
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
                onClick={() => {
                  setIsSignUp((current) => !current);
                }}
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
