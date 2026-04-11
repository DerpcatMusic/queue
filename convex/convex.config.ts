import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import geospatial from "@convex-dev/geospatial/convex.config.js";
import stripe from "@convex-dev/stripe/convex.config.js";
import workflow from "@convex-dev/workflow/convex.config.js";
import workpool from "@convex-dev/workpool/convex.config.js";
import { defineApp } from "convex/server";

const app = defineApp();

// Compliance review workpool: handles AI document review with retries
// Uses exponential backoff to avoid thundering-herd on Gemini outages
app.use(workpool, { name: "complianceWorkpool" });

// Workflow component: enables durable multi-step execution
// Not currently used by compliance but available for complex workflows
app.use(workflow);

// Rate limiter: protects Gemini API quota from abuse
app.use(rateLimiter);

// Geospatial component: point/radius matching for instructors and studios
app.use(geospatial);

// Stripe: checkout, billing, and webhook sync foundation for payments migration
app.use(stripe);

export default app;
