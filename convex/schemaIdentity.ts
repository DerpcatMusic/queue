import { identityCoreTables } from "./schemaIdentityCore";
import { identityInstructorTables } from "./schemaIdentityInstructor";
import { identityIntegrationTables } from "./schemaIdentityIntegration";
import { identityStudioTables } from "./schemaIdentityStudio";

export { identityCoreTables } from "./schemaIdentityCore";
export { identityInstructorTables } from "./schemaIdentityInstructor";
export { identityIntegrationTables } from "./schemaIdentityIntegration";
export { identityStudioTables } from "./schemaIdentityStudio";

export const identityTables = {
  ...identityCoreTables,
  ...identityInstructorTables,
  ...identityStudioTables,
  ...identityIntegrationTables,
};
