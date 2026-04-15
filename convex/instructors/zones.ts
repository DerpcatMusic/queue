import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

// Compatibility shim for the deleted zone system.
// The client still calls these functions during the migration window, so keep
// them available and return an empty selection rather than crashing boot.

export const getMyInstructorZones = query({
  args: {},
  returns: v.object({
    zoneIds: v.array(v.string()),
  }),
  handler: async () => {
    return { zoneIds: [] };
  },
});

export const setMyInstructorZones = mutation({
  args: {
    zoneIds: v.array(v.string()),
  },
  returns: v.object({
    zoneIds: v.array(v.string()),
  }),
  handler: async (_ctx, args) => {
    return { zoneIds: args.zoneIds };
  },
});