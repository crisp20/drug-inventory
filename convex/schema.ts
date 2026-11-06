import { defineSchema } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { activityLogTable } from "./schema/activity";
import { usersTable } from "./schema/users";
import { drugPackagesTable, drugsTable, lasaLinksTable } from "./schema/drugs";
import { settingsTable } from "./schema/settings";
import { stockMovementsTable } from "./schema/stock";

export default defineSchema({
  ...authTables,
  users: usersTable,
  drugs: drugsTable,
  drugPackages: drugPackagesTable,
  lasaLinks: lasaLinksTable,
  stockMovements: stockMovementsTable,
  settings: settingsTable,
  activityLog: activityLogTable,
});
