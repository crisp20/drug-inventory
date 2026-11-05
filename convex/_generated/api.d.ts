/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activity from "../activity.js";
import type * as auth from "../auth.js";
import type * as drugImport from "../drugImport.js";
import type * as drugPhotos from "../drugPhotos.js";
import type * as drugs from "../drugs.js";
import type * as http from "../http.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_activity from "../lib/activity.js";
import type * as lib_barcode from "../lib/barcode.js";
import type * as lib_canister from "../lib/canister.js";
import type * as lib_drugImport from "../lib/drugImport.js";
import type * as lib_drugPhotos from "../lib/drugPhotos.js";
import type * as lib_drugs from "../lib/drugs.js";
import type * as lib_expiry from "../lib/expiry.js";
import type * as lib_gs1 from "../lib/gs1.js";
import type * as lib_period from "../lib/period.js";
import type * as lib_settings from "../lib/settings.js";
import type * as lib_stock from "../lib/stock.js";
import type * as schema_activity from "../schema/activity.js";
import type * as schema_drugs from "../schema/drugs.js";
import type * as schema_settings from "../schema/settings.js";
import type * as schema_stock from "../schema/stock.js";
import type * as schema_users from "../schema/users.js";
import type * as settings from "../settings.js";
import type * as stock from "../stock.js";
import type * as testUsers from "../testUsers.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activity: typeof activity;
  auth: typeof auth;
  drugImport: typeof drugImport;
  drugPhotos: typeof drugPhotos;
  drugs: typeof drugs;
  http: typeof http;
  "lib/access": typeof lib_access;
  "lib/activity": typeof lib_activity;
  "lib/barcode": typeof lib_barcode;
  "lib/canister": typeof lib_canister;
  "lib/drugImport": typeof lib_drugImport;
  "lib/drugPhotos": typeof lib_drugPhotos;
  "lib/drugs": typeof lib_drugs;
  "lib/expiry": typeof lib_expiry;
  "lib/gs1": typeof lib_gs1;
  "lib/period": typeof lib_period;
  "lib/settings": typeof lib_settings;
  "lib/stock": typeof lib_stock;
  "schema/activity": typeof schema_activity;
  "schema/drugs": typeof schema_drugs;
  "schema/settings": typeof schema_settings;
  "schema/stock": typeof schema_stock;
  "schema/users": typeof schema_users;
  settings: typeof settings;
  stock: typeof stock;
  testUsers: typeof testUsers;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
