import { billingCurrentTables } from "./schemaBillingCurrent";
import { billingLegacyTables } from "./schemaBillingLegacy";

export const billingTables = {
  ...billingLegacyTables,
  ...billingCurrentTables,
};
export { billingCurrentTables } from "./schemaBillingCurrent";
export { billingLegacyTables } from "./schemaBillingLegacy";
