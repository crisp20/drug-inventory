import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { convex } from "./convex.tsx";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>;
}
