import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { canUseCanister } from "@/convex/lib/canister.ts";
import { useCurrentUser } from "./use-current-user.ts";

// Canister features stay hidden until an admin switches them on for this person or everyone
export function useCanisterEnabled(): boolean {
  const { isAuthenticated } = useConvexAuth();
  const me = useCurrentUser();
  const settings = useQuery(api.settings.get, isAuthenticated ? {} : "skip");
  if (!me || !settings) return false;
  return canUseCanister(me, settings.canisterForEveryone);
}
