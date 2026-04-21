import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

/**
 * Migration: Verify and enforce unique constraints on business-critical tables.
 * 
 * This migration checks for existing data that would violate the new unique indexes:
 * 1. jobApplications: (jobId, instructorId) - no duplicate applications
 * 2. jobApplications: (jobId, status='accepted') - no double-fill
 * 3. internalAccessGrants: (email, active) - no duplicate active grants
 * 
 * Run with: npx convex run internal.migrations.enforceUniqueConstraints.verifyAndReport
 * 
 * If violations exist, run cleanup before deploying schema changes.
 */

/**
 * Check for duplicate job applications (same instructor applying twice to same job)
 */
export const checkDuplicateApplications = internalMutation({
  args: {},
  returns: v.object({
    hasViolations: v.boolean(),
    violations: v.array(v.object({
      jobId: v.id("jobs"),
      instructorId: v.id("instructorProfiles"),
      applicationIds: v.array(v.id("jobApplications")),
      count: v.number(),
    })),
    totalViolations: v.number(),
  }),
  handler: async (ctx) => {
    const allApplications = await ctx.db.query("jobApplications").collect();
    
    // Group by (jobId, instructorId)
    const grouped = new Map<string, { jobId: Id<"jobs">; instructorId: Id<"instructorProfiles">; applications: Doc<"jobApplications">[] }>();
    
    for (const app of allApplications) {
      const key = `${app.jobId}:${app.instructorId}`;
      if (!grouped.has(key)) {
        grouped.set(key, { jobId: app.jobId, instructorId: app.instructorId, applications: [] });
      }
      grouped.get(key)!.applications.push(app);
    }
    
    // Find duplicates
    const violations: { jobId: Id<"jobs">; instructorId: Id<"instructorProfiles">; applicationIds: Id<"jobApplications">[]; count: number }[] = [];
    
    for (const [_, group] of grouped) {
      if (group.applications.length > 1) {
        // Sort by appliedAt descending - keep the latest, mark others for deletion
        group.applications.sort((a, b) => b.appliedAt - a.appliedAt);
        
        violations.push({
          jobId: group.jobId,
          instructorId: group.instructorId,
          applicationIds: group.applications.map(a => a._id),
          count: group.applications.length,
        });
      }
    }
    
    return {
      hasViolations: violations.length > 0,
      violations,
      totalViolations: violations.reduce((sum, v) => sum + v.count - 1, 0), // Excess applications
    };
  },
});

/**
 * Check for multiple active internal access grants with the same email
 */
export const checkDuplicateActiveGrants = internalMutation({
  args: {},
  returns: v.object({
    hasViolations: v.boolean(),
    violations: v.array(v.object({
      email: v.string(),
      grantIds: v.array(v.id("internalAccessGrants")),
      count: v.number(),
    })),
    totalViolations: v.number(),
  }),
  handler: async (ctx) => {
    const allGrants = await ctx.db.query("internalAccessGrants").collect();
    
    // Group by email for active grants
    const activeByEmail = new Map<string, { email: string; grants: Doc<"internalAccessGrants">[] }>();
    
    for (const grant of allGrants) {
      if (grant.active && grant.email) {
        if (!activeByEmail.has(grant.email)) {
          activeByEmail.set(grant.email, { email: grant.email, grants: [] });
        }
        activeByEmail.get(grant.email)!.grants.push(grant);
      }
    }
    
    // Find duplicates (multiple active grants for same email)
    const violations: { email: string; grantIds: Id<"internalAccessGrants">[]; count: number }[] = [];
    
    for (const [_, group] of activeByEmail) {
      if (group.grants.length > 1) {
        // Sort by createdAt ascending - keep earliest, mark others for deletion
        group.grants.sort((a, b) => a.createdAt - b.createdAt);
        
        violations.push({
          email: group.email,
          grantIds: group.grants.map(g => g._id),
          count: group.grants.length,
        });
      }
    }
    
    return {
      hasViolations: violations.length > 0,
      violations,
      totalViolations: violations.reduce((sum, v) => sum + v.count - 1, 0),
    };
  },
});

/**
 * Check for multiple 'accepted' applications for the same job (double-fill)
 */
export const checkDoubleFillViolations = internalMutation({
  args: {},
  returns: v.object({
    hasViolations: v.boolean(),
    violations: v.array(v.object({
      jobId: v.id("jobs"),
      applicationIds: v.array(v.id("jobApplications")),
      count: v.number(),
    })),
    totalViolations: v.number(),
  }),
  handler: async (ctx) => {
    const allApplications = await ctx.db.query("jobApplications").collect();
    
    // Filter to accepted applications and group by jobId
    const acceptedByJob = new Map<string, { jobId: Id<"jobs">; applications: Doc<"jobApplications">[] }>();
    
    for (const app of allApplications) {
      if (app.status === "accepted") {
        if (!acceptedByJob.has(app.jobId)) {
          acceptedByJob.set(app.jobId, { jobId: app.jobId, applications: [] });
        }
        acceptedByJob.get(app.jobId)!.applications.push(app);
      }
    }
    
    // Find jobs with multiple accepted applications
    const violations: { jobId: Id<"jobs">; applicationIds: Id<"jobApplications">[]; count: number }[] = [];
    
    for (const [_, group] of acceptedByJob) {
      if (group.applications.length > 1) {
        // Sort by updatedAt descending - keep most recently updated
        group.applications.sort((a, b) => b.updatedAt - a.updatedAt);
        
        violations.push({
          jobId: group.jobId,
          applicationIds: group.applications.map(a => a._id),
          count: group.applications.length,
        });
      }
    }
    
    return {
      hasViolations: violations.length > 0,
      violations,
      totalViolations: violations.reduce((sum, v) => sum + v.count - 1, 0),
    };
  },
});

/**
 * Clean up duplicate applications - keeps the most recent application per (jobId, instructorId)
 */
export const cleanupDuplicateApplications = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()), // If true, only report what would be deleted
  },
  returns: v.object({
    deletedCount: v.number(),
    wouldDeleteCount: v.optional(v.number()),
    deletedIds: v.array(v.id("jobApplications")),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.runMutation(internal.migrations.enforceUniqueConstraints.checkDuplicateApplications, {});
    
    if (!result.hasViolations) {
      return { deletedCount: 0, deletedIds: [] };
    }
    
    const toDelete: Id<"jobApplications">[] = [];
    
    for (const violation of result.violations) {
      // Skip first (most recent) application, delete the rest
      for (let i = 1; i < violation.applicationIds.length; i++) {
        toDelete.push(violation.applicationIds[i]);
      }
    }
    
    if (args.dryRun ?? false) {
      return { deletedCount: 0, wouldDeleteCount: toDelete.length, deletedIds: toDelete };
    }
    
    // Delete duplicates
    for (const id of toDelete) {
      await ctx.db.delete(id);
    }
    
    return { deletedCount: toDelete.length, deletedIds: toDelete };
  },
});

/**
 * Clean up duplicate active grants - keeps the earliest created grant per email
 */
export const cleanupDuplicateActiveGrants = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    deletedCount: v.number(),
    wouldDeleteCount: v.optional(v.number()),
    deletedIds: v.array(v.id("internalAccessGrants")),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.runMutation(internal.migrations.enforceUniqueConstraints.checkDuplicateActiveGrants, {});
    
    if (!result.hasViolations) {
      return { deletedCount: 0, deletedIds: [] };
    }
    
    const toDelete: Id<"internalAccessGrants">[] = [];
    
    for (const violation of result.violations) {
      // Skip first (earliest created) grant, delete the rest
      for (let i = 1; i < violation.grantIds.length; i++) {
        toDelete.push(violation.grantIds[i]);
      }
    }
    
    if (args.dryRun ?? false) {
      return { deletedCount: 0, wouldDeleteCount: toDelete.length, deletedIds: toDelete };
    }
    
    // Delete duplicates
    for (const id of toDelete) {
      await ctx.db.delete(id);
    }
    
    return { deletedCount: toDelete.length, deletedIds: toDelete };
  },
});

/**
 * Clean up double-fill violations - keeps the most recently updated 'accepted' application per job
 * NOTE: This may need business logic review as it affects job assignments
 */
export const cleanupDoubleFillViolations = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    deletedCount: v.number(),
    wouldDeleteCount: v.optional(v.number()),
    deletedIds: v.array(v.id("jobApplications")),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.runMutation(internal.migrations.enforceUniqueConstraints.checkDoubleFillViolations, {});
    
    if (!result.hasViolations) {
      return { deletedCount: 0, deletedIds: [] };
    }
    
    const toDelete: Id<"jobApplications">[] = [];
    
    for (const violation of result.violations) {
      // Skip first (most recently updated) application, delete the rest
      for (let i = 1; i < violation.applicationIds.length; i++) {
        toDelete.push(violation.applicationIds[i]);
      }
    }
    
    if (args.dryRun ?? false) {
      return { deletedCount: 0, wouldDeleteCount: toDelete.length, deletedIds: toDelete };
    }
    
    // Delete duplicates - converting extra accepted to rejected
    for (const id of toDelete) {
      await ctx.db.patch(id, { status: "rejected", updatedAt: Date.now() });
    }
    
    return { deletedCount: toDelete.length, deletedIds: toDelete };
  },
});