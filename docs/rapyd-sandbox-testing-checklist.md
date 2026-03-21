# Rapyd Sandbox Testing Checklist

## Required Convex env vars

Set these before end-to-end testing:

- `RAPYD_MODE=sandbox`
- `RAPYD_CHECKOUT_MODE=a2a`
- `RAPYD_SANDBOX_BASE_URL=https://sandboxapi.rapyd.net`
- `RAPYD_ACCESS_KEY=<rapyd_sandbox_access_key>`
- `RAPYD_SECRET_KEY=<rapyd_sandbox_secret_key>`
- `RAPYD_WEBHOOK_SECRET=<rapyd_webhook_secret_or_secret_key>`
- `RAPYD_COUNTRY=IL`
- `RAPYD_EWALLET=<rapyd_platform_ewallet_id>`
- `RAPYD_COMPLETE_CHECKOUT_URL=<public_https_complete_url>`
- `RAPYD_CANCEL_CHECKOUT_URL=<public_https_cancel_url>`
- `RAPYD_BENEFICIARY_COMPLETE_URL=https://join-queue.com/rapyd/beneficiary-return?result=complete`
- `RAPYD_BENEFICIARY_CANCEL_URL=https://join-queue.com/rapyd/beneficiary-return?result=cancel`
- `PAYMENTS_CURRENCY=ILS`
- `QUICKFIT_PLATFORM_MARKUP_BPS=1500`
- `PAYOUT_RELEASE_MODE=manual`
- `PAYMENTS_ALLOWED_REDIRECT_PROTOCOLS=https:,queue:,exp:,exps:`

Optional for local/sandbox UX:

- `PAYMENTS_ALLOWED_REDIRECT_HOSTS=<comma-separated-https-hosts>`
- `RAPYD_PAYMENT_METHODS=<comma-separated-country-valid-method-types>`
- `ALLOW_SANDBOX_DESTINATION_SELF_VERIFY=1`

Notes:

- Keep Rapyd base URLs as host-only URLs (no query/hash). Example: `https://sandboxapi.rapyd.net`
- If you set both `RAPYD_SANDBOX_BASE_URL` and `RAPYD_BASE_URL`, sandbox uses `RAPYD_SANDBOX_BASE_URL`.
- Hosted page URLs must be public `https` URLs and cannot be `localhost`, `exp://`, `exps://`, or custom app schemes.
- If `RAPYD_CHECKOUT_MODE=a2a`, checkout defaults to bank-transfer and bank-redirect methods and fails closed if Rapyd cannot resolve them for your IL account.
- If `RAPYD_PAYMENT_METHODS` is unset and `RAPYD_CHECKOUT_MODE=flexible`, checkout falls back to Rapyd's default country-valid methods.
- If you use `join-queue.com`, make sure app config includes universal links (`applinks:join-queue.com`) and Android intent filters for `https://join-queue.com/rapyd/*`.

## Webhook setup

Configure Rapyd webhook to:

- `POST https://<your-convex-domain>/webhooks/rapyd`

The backend verifies signature and timestamp before processing.

## Test flow

1. Studio opens Jobs and taps `Pay now` on a filled/completed lesson.
2. Complete checkout in Rapyd hosted page.
3. Confirm payment row becomes `captured` after webhook.
4. Instructor opens Profile -> Payments.
5. Add payout destination (beneficiary/external recipient reference).
6. Complete Rapyd beneficiary hosted flow and return to `https://join-queue.com/rapyd/beneficiary-return`.
7. Confirm webhook event arrives at `/webhooks/rapyd` with `signatureValid=true`.
8. If running sandbox with `ALLOW_SANDBOX_DESTINATION_SELF_VERIFY=1`, mark destination verified in-app.
9. Tap `Withdraw to bank`.
10. Confirm payout transitions: `queued` -> `processing` -> `pending_provider`/`paid`.

## Sandbox virtual account test

Use this when you want a fake bank account number and a simulated inbound transfer:

1. Call `convex/rapyd.createSandboxVirtualAccountForEwallet` in sandbox mode.
2. Use the returned `virtualAccountId` / bank account details as the simulated receiving account.
3. Call `convex/rapyd.simulateSandboxVirtualAccountTransfer` with a small amount.
4. Verify the virtual account history in Rapyd shows the deposit.
5. If you want to inspect the wallet list, call `convex/rapyd.listSandboxVirtualAccountsForEwallet`.

Notes:

- These helpers are sandbox-only and will fail closed in production.
- This tests the inbound bank-rail plumbing. It does not replace the instructor payout flow yet.

## Expected money behavior

For lesson pay `120 ILS`:

- Instructor payout target: `120 ILS`
- Platform markup (15%): `18 ILS`
- Studio charge target: `138 ILS`

Payouts are created from `instructorBaseAmountAgorot`, so instructor-side payout target stays the lesson pay amount.
