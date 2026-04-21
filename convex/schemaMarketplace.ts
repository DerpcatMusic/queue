import { marketplaceJobsTables } from "./schemaMarketplaceJobs";
import { marketplaceOpsTables } from "./schemaMarketplaceOps";
import { marketplaceSettlementTables } from "./schemaMarketplaceSettlement";

export { marketplaceJobsTables } from "./schemaMarketplaceJobs";
export { marketplaceOpsTables } from "./schemaMarketplaceOps";
export { marketplaceSettlementTables } from "./schemaMarketplaceSettlement";

export const marketplaceTables = {
  ...marketplaceJobsTables,
  ...marketplaceSettlementTables,
  ...marketplaceOpsTables,
};
