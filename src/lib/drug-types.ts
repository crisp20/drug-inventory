import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api.js";

export type DrugWithDetails = NonNullable<FunctionReturnType<typeof api.drugs.get>>;
export type DrugPackage = DrugWithDetails["packages"][number];
