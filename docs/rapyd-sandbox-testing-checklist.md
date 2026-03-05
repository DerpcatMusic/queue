# Rapyd Sandbox Testing Checklist

## Required Convex env vars

Set these before end-to-end testing:

- `RAPYD_MODE=sandbox`
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
- If `RAPYD_PAYMENT_METHODS` is unset, checkout falls back to Rapyd's default country-valid methods.
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

## Expected money behavior

For lesson pay `120 ILS`:

- Instructor payout target: `120 ILS`
- Platform markup (15%): `18 ILS`
- Studio charge target: `138 ILS`

Payouts are created from `instructorBaseAmountAgorot`, so instructor-side payout target stays the lesson pay amount.
