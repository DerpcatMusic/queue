/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as constants from "../constants.js";
import type * as inbox from "../inbox.js";
import type * as instructorZones from "../instructorZones.js";
import type * as jobs from "../jobs.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_domainValidation from "../lib/domainValidation.js";
import type * as lib_instructorCoverage from "../lib/instructorCoverage.js";
import type * as lib_validation from "../lib/validation.js";
import type * as notifications from "../notifications.js";
import type * as notificationsCore from "../notificationsCore.js";
import type * as onboarding from "../onboarding.js";
import type * as userPushNotifications from "../userPushNotifications.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  constants: typeof constants;
  inbox: typeof inbox;
  instructorZones: typeof instructorZones;
  jobs: typeof jobs;
  "lib/auth": typeof lib_auth;
  "lib/domainValidation": typeof lib_domainValidation;
  "lib/instructorCoverage": typeof lib_instructorCoverage;
  "lib/validation": typeof lib_validation;
  notifications: typeof notifications;
  notificationsCore: typeof notificationsCore;
  onboarding: typeof onboarding;
  userPushNotifications: typeof userPushNotifications;
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
