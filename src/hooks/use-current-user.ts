import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";

// Returns undefined while loading, null when no profile exists yet
export function useCurrentUser() {
  const { isAuthenticated } = useConvexAuth();
  return useQuery(api.users.getCurrentUser, isAuthenticated ? {} : "skip");
}
