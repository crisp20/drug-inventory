import { defineSchema } from "convex/server";
import { activityLogTable } from "./schema/activity";
import { usersTable } from "./schema/users";
import { drugPackagesTable, drugsTable } from "./schema/drugs";
import { settingsTable } from "./schema/settings";
import { stockMovementsTable } from "./schema/stock";

export default defineSchema({
  users: usersTable,
  drugs: drugsTable,
  drugPackages: drugPackagesTable,
  stockMovements: stockMovementsTable,
  settings: settingsTable,
  activityLog: activityLogTable,
});
