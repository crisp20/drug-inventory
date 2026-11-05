import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { LogOut, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  ResetPasswordDialog,
  ResetPasswordMenuItem,
} from "@/components/reset-password-menu-item.tsx";
import { errorMessage } from "@/lib/errors.ts";

export function AccountMenu({
  user,
  className,
}: {
  user: { name?: string; email?: string; role?: string };
  className?: string;
}) {
  const { signOut } = useAuthActions();
  const [signingOut, setSigningOut] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const name = user.name ?? user.email ?? "Account";

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      toast.error(errorMessage(error, "Could not sign out"));
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="lg"
            className={cn(
              "justify-between gap-3 bg-background shadow-md",
              className,
            )}
            aria-label="Account options"
          >
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm font-semibold">
                {name}
              </span>
              {user.role && (
                <span className="block text-xs capitalize text-muted-foreground">
                  {user.role}
                </span>
              )}
            </span>
            <MoreHorizontal className="size-4 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <ResetPasswordMenuItem onSelect={() => setResetPasswordOpen(true)} />
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={signingOut}
            onSelect={() => void handleSignOut()}
          >
            <LogOut />
            {signingOut ? "Signing out..." : "Log out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ResetPasswordDialog
        open={resetPasswordOpen}
        onOpenChange={setResetPasswordOpen}
        userLabel="your account"
      />
    </>
  );
}
