import { useState } from "react";
import { useAction } from "convex/react";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { errorMessage } from "@/lib/errors.ts";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  PASSWORD_REQUIREMENTS_MESSAGE,
} from "@/convex/lib/password.ts";

export function ResetPasswordMenuItem({ onSelect }: { onSelect: () => void }) {
  return (
    <DropdownMenuItem onSelect={onSelect}>
      <KeyRound />
      Reset password
    </DropdownMenuItem>
  );
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  userId,
  userLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: Id<"users">;
  userLabel: string;
}) {
  const resetPassword = useAction(api.users.resetPassword);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setNewPassword("");
      setConfirmPassword("");
      setShowPassword(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setSaving(true);
    try {
      await resetPassword(userId ? { userId, newPassword } : { newPassword });
      toast.success(`Password reset for ${userLabel}`);
      handleOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error, "Could not reset password"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Set a new password for {userLabel}. {PASSWORD_REQUIREMENTS_MESSAGE}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="space-y-4"
        >
          <div className="space-y-2">
            <label htmlFor="reset-password" className="text-sm font-medium">
              New password
            </label>
            <div className="relative">
              <Input
                id="reset-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                maxLength={MAX_PASSWORD_LENGTH}
                required
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute top-0 right-0"
                onClick={() => setShowPassword((shown) => !shown)}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <label
              htmlFor="reset-confirm-password"
              className="text-sm font-medium"
            >
              Confirm new password
            </label>
            <div className="relative">
              <Input
                id="reset-confirm-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                maxLength={MAX_PASSWORD_LENGTH}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute top-0 right-0"
                onClick={() => setShowPassword((shown) => !shown)}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? "Please wait..." : "Save new password"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
