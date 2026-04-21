import { authTables } from "@convex-dev/auth/server";
import { defineSchema } from "convex/server";
import { auditTables } from "./schemaAudit";
import { billingTables } from "./schemaBilling";
import { deletionTables } from "./schemaDeletion";
import { identityTables } from "./schemaIdentity";
import { marketplaceTables } from "./schemaMarketplace";
import { notificationTables } from "./schemaNotifications";

export default defineSchema({
  ...authTables,
  ...identityTables,
  ...marketplaceTables,
  ...billingTables,
  ...notificationTables,
  ...auditTables,
  ...deletionTables,
});
