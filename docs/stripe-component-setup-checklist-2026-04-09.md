# Stripe Component Setup Checklist

Date: 2026-04-09

Official sources:
- https://www.convex.dev/components/stripe/stripe.md
- https://www.convex.dev/components/stripe/llms.txt

Installed package:
- `npm install @convex-dev/stripe`

Current repo state:
- `@convex-dev/stripe` was added to `package.json`.
- `npm install` also rewrote parts of `package-lock.json` and normalized some existing dependency entries unrelated to Stripe. Review before commit.

Important scope warning:
- The official `@convex-dev/stripe` component documentation covers Stripe Checkout, subscriptions, invoices, customer portal, and webhook sync.
- It does not document Stripe Connect account onboarding, destination charges, application fees, or transfers/payout orchestration for marketplace split-pay.
- For a full Airwallex replacement in this app, treat this component as a billing/payment-sync foundation, not the full instructor split-payout solution.

## Exact Setup Checklist

1. Install the package:
   - `npm install @convex-dev/stripe`
2. Mount the Convex component in `convex/convex.config.ts`:
   - Import `stripe` from `@convex-dev/stripe/convex.config.js`
   - Add `app.use(stripe);`
3. Register the webhook route in `convex/http.ts`:
   - Import `components` from `./_generated/api`
   - Import `registerRoutes` from `@convex-dev/stripe`
   - Register `registerRoutes(http, components.stripe, { webhookPath: "/stripe/webhook" });`
4. Set Convex environment variables:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
5. Configure the Stripe webhook endpoint in Stripe Dashboard:
   - Endpoint: `https://<your-convex-deployment>.convex.site/stripe/webhook`
   - Required events from the docs:
     - `checkout.session.completed`
     - `customer.created`
     - `customer.updated`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.created`
     - `invoice.finalized`
     - `invoice.paid`
     - `invoice.payment_failed`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
6. Copy Stripe’s webhook signing secret into Convex as `STRIPE_WEBHOOK_SECRET`.
7. Create a Convex action that initializes `StripeSubscriptions` with `components.stripe`.
8. Use that action to create Checkout sessions and, if needed, Customer Portal sessions.
9. Attach app metadata when creating sessions so payments can be linked back to your domain entities.
   - Example shape from docs supports `metadata`, `subscriptionMetadata`, and `paymentIntentMetadata`.
10. Query synced payment data from the component instead of maintaining parallel Stripe shadow tables unless your marketplace flow requires custom data.

## Required Environment Variables

Required by the official component docs:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Not documented as part of this component, but likely needed for your full marketplace migration if you implement Stripe Connect separately:
- Connect platform configuration
- Connected account onboarding configuration
- Marketplace payout or transfer settings
- Any publishable/mobile client keys required by your frontend checkout flow

## Verification Steps

1. Confirm the package is present:
   - `package.json` contains `@convex-dev/stripe`
2. Confirm Convex config wiring:
   - `convex/convex.config.ts` imports Stripe component config and calls `app.use(stripe);`
3. Confirm webhook wiring:
   - `convex/http.ts` registers `/stripe/webhook`
4. Confirm env vars exist in Convex:
   - `STRIPE_SECRET_KEY` set
   - `STRIPE_WEBHOOK_SECRET` set
5. Confirm Stripe dashboard webhook matches the Convex URL and includes the required events above.
6. Start local/dev Convex and create a test Checkout session from a Convex action.
7. Complete a Stripe test-mode payment.
8. Verify webhook delivery succeeds in Stripe Dashboard.
9. Verify synced data appears through the component queries:
   - customer
   - payment
   - invoice or subscription, depending on flow
10. Verify your app-level metadata is present on the resulting Stripe objects so you can reconcile users, studios, instructors, and jobs.

## Recommended Migration Order For This Repo

1. Add and verify the base Stripe component.
2. Decide whether lesson payments are:
   - plain checkout only, or
   - Stripe Connect marketplace payments with split settlement.
3. Only after that decision, remove Airwallex backend and UI flows:
   - Convex Airwallex integration files
   - Airwallex webhook route
   - Airwallex native package and onboarding UI
   - Airwallex-specific schema fields, translations, and provider adapters
4. Implement the replacement payout model for instructors before deleting payout data paths currently backed by Airwallex.
