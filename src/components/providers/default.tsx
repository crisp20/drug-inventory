import { AuthProvider } from "./auth.tsx";
import { ConfirmProvider } from "./confirm.tsx";
import { UnsavedChangesProvider } from "./unsaved-changes.tsx";
import { QueryClientProvider } from "./query-client.tsx";
import { ThemeProvider } from "./theme.tsx";
import { Toaster } from "../ui/sonner.tsx";
import { TooltipProvider } from "../ui/tooltip.tsx";

export function DefaultProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <QueryClientProvider>
        <TooltipProvider>
          <ThemeProvider>
            <Toaster />
            <ConfirmProvider>
              <UnsavedChangesProvider>{children}</UnsavedChangesProvider>
            </ConfirmProvider>
          </ThemeProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}
