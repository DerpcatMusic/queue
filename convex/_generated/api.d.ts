/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as calendar from "../calendar.js";
import type * as constants from "../constants.js";
import type * as didit from "../didit.js";
import type * as home from "../home.js";
import type * as http from "../http.js";
import type * as inbox from "../inbox.js";
import type * as instructorZones from "../instructorZones.js";
import type * as invoicing from "../invoicing.js";
import type * as jobs from "../jobs.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_domainValidation from "../lib/domainValidation.js";
import type * as lib_instructorCoverage from "../lib/instructorCoverage.js";
import type * as lib_instructorEligibility from "../lib/instructorEligibility.js";
import type * as lib_validation from "../lib/validation.js";
import type * as migrations from "../migrations.js";
import type * as notifications from "../notifications.js";
import type * as notificationsCore from "../notificationsCore.js";
import type * as onboarding from "../onboarding.js";
import type * as payments from "../payments.js";
import type * as payouts from "../payouts.js";
import type * as rapyd from "../rapyd.js";
import type * as rapydReturnBridge from "../rapydReturnBridge.js";
import type * as resendMagicLink from "../resendMagicLink.js";
import type * as resendOtp from "../resendOtp.js";
import type * as userPushNotifications from "../userPushNotifications.js";
import type * as users from "../users.js";
import type * as webhooks from "../webhooks.js";
import type * as webhookSecurity from "../webhookSecurity.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  calendar: typeof calendar;
  constants: typeof constants;
  didit: typeof didit;
  home: typeof home;
  http: typeof http;
  inbox: typeof inbox;
  instructorZones: typeof instructorZones;
  invoicing: typeof invoicing;
  jobs: typeof jobs;
  "lib/auth": typeof lib_auth;
  "lib/domainValidation": typeof lib_domainValidation;
  "lib/instructorCoverage": typeof lib_instructorCoverage;
  "lib/instructorEligibility": typeof lib_instructorEligibility;
  "lib/validation": typeof lib_validation;
  migrations: typeof migrations;
  notifications: typeof notifications;
  notificationsCore: typeof notificationsCore;
  onboarding: typeof onboarding;
  payments: typeof payments;
  payouts: typeof payouts;
  rapyd: typeof rapyd;
  rapydReturnBridge: typeof rapydReturnBridge;
  resendMagicLink: typeof resendMagicLink;
  resendOtp: typeof resendOtp;
  userPushNotifications: typeof userPushNotifications;
  users: typeof users;
  webhooks: typeof webhooks;
  webhookSecurity: typeof webhookSecurity;
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
