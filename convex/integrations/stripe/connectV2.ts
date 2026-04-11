"use node";

import StripeSDK from "stripe";

const STRIPE_ACCOUNTS_V2_API_VERSION = "2026-02-25.preview";
const STRIPE_API_BASE_URL = "https://api.stripe.com";

function requireStripeSecretKey() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return secretKey;
}

type StripeFetchOptions = {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  include?: string[];
};

async function stripeV2Fetch<T>(input: StripeFetchOptions): Promise<T> {
  const secretKey = requireStripeSecretKey();
  const url = new URL(`${STRIPE_API_BASE_URL}${input.path}`);

  if (input.include) {
    input.include.forEach((value, index) => {
      url.searchParams.append(`include[${index}]`, value);
    });
  }

  const response = await fetch(url, {
    method: input.method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      "Stripe-Version": STRIPE_ACCOUNTS_V2_API_VERSION,
    },
    ...(input.body ? { body: JSON.stringify(input.body) } : {}),
  });

  const data = (await response.json()) as T | { error?: { message?: string } };
  if (!response.ok) {
    const message =
      typeof data === "object" && data && "error" in data ? data.error?.message : undefined;
    throw new Error(message || `Stripe API request failed: ${response.status}`);
  }

  return data as T;
}

export type StripeAccountV2 = {
  id: string;
  dashboard?: "express" | "full" | "none" | null;
  contact_email?: string | null;
  display_name?: string | null;
  defaults?: {
    responsibilities?: {
      requirements_collector?: "application" | "stripe" | null;
    } | null;
  } | null;
  identity?: {
    business_details?: {
      registered_name?: string | null;
    } | null;
    country?: string | null;
    entity_type?: string | null;
  } | null;
  requirements?: {
    entries?: Array<{
      description?: string | null;
      awaiting_action_from?: string | null;
      errors?: Array<{ reason?: string | null; code?: string | null }> | null;
      minimum_deadline?: {
        status?: string | null;
      } | null;
    }> | null;
  } | null;
  configuration?: {
    merchant?: {
      applied?: boolean;
      capabilities?: {
        card_payments?: {
          status?: "active" | "pending" | "restricted" | "unsupported" | null;
          status_details?: Array<{
            code?: string | null;
            resolution?: string | null;
          }> | null;
        } | null;
        stripe_balance?: {
          payouts?: {
            status?: "active" | "pending" | "restricted" | "unsupported" | null;
            status_details?: Array<{
              code?: string | null;
              resolution?: string | null;
            }> | null;
          } | null;
        } | null;
      } | null;
    } | null;
    recipient?: {
      applied?: boolean;
      capabilities?: {
        stripe_balance?: {
          stripe_transfers?: {
            status?: "active" | "pending" | "restricted" | "unsupported" | null;
            status_details?: Array<{
              code?: string | null;
              resolution?: string | null;
            }> | null;
          } | null;
        } | null;
      } | null;
    } | null;
  } | null;
};

export type StripeAccountPersonV2 = {
  id: string;
  given_name?: string | null;
  surname?: string | null;
  relationship?: {
    representative?: boolean | null;
    owner?: boolean | null;
    title?: string | null;
  } | null;
};

export function summarizeStripeRecipientAccountStatus(account: StripeAccountV2) {
  const merchantCardPaymentsStatus =
    account.configuration?.merchant?.capabilities?.card_payments?.status;
  const merchantPayoutsStatus =
    account.configuration?.merchant?.capabilities?.stripe_balance?.payouts?.status;
  const transferStatus =
    account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status;
  const statuses = [merchantCardPaymentsStatus, merchantPayoutsStatus, transferStatus].filter(
    Boolean,
  );

  if (statuses.includes("unsupported")) {
    return "unsupported" as const;
  }
  if (statuses.length > 0 && statuses.every((status) => status === "active")) {
    return "active" as const;
  }
  const requirements = summarizeStripeRecipientRequirements(account);
  if (requirements.blockingCount > 0) {
    return "restricted" as const;
  }
  if (statuses.includes("restricted")) {
    return "restricted" as const;
  }
  return "pending" as const;
}

export function summarizeStripeRecipientRequirements(account: StripeAccountV2) {
  const entries = account.requirements?.entries ?? [];
  const blockingEntries = entries.filter((entry) => {
    const awaiting = entry.awaiting_action_from?.toLowerCase();
    return awaiting === "account_holder" || awaiting === "platform";
  });
  const summary =
    blockingEntries
      .map((entry) => entry.description?.trim())
      .filter((value): value is string => Boolean(value))
      .slice(0, 3)
      .join(" • ") || undefined;

  return {
    blockingCount: blockingEntries.length,
    summary,
  };
}

export async function createStripeRecipientAccountV2(input: {
  email: string;
  displayName: string;
  country: string;
  defaultCurrency: string;
}) {
  return await stripeV2Fetch<StripeAccountV2>({
    method: "POST",
    path: "/v2/core/accounts",
    include: ["configuration.merchant", "configuration.recipient", "identity", "requirements"],
    body: {
      contact_email: input.email,
      display_name: input.displayName,
      dashboard: "none",
      identity: {
        country: input.country,
        entity_type: "individual",
      },
      configuration: {
        merchant: {
          capabilities: {
            card_payments: {
              requested: true,
            },
          },
        },
        recipient: {
          capabilities: {
            stripe_balance: {
              stripe_transfers: {
                requested: true,
              },
            },
          },
        },
      },
      defaults: {
        currency: input.defaultCurrency.toLowerCase(),
        responsibilities: {
          fees_collector: "stripe",
          losses_collector: "application",
        },
        locales: ["en-US"],
      },
    },
  });
}

export async function retrieveStripeAccountV2(accountId: string) {
  return await stripeV2Fetch<StripeAccountV2>({
    method: "GET",
    path: `/v2/core/accounts/${accountId}`,
    include: ["configuration.merchant", "configuration.recipient", "identity", "requirements"],
  });
}

export async function updateStripeAccountV2(
  accountId: string,
  updates: {
    feesCollector?: "stripe" | "application";
  },
) {
  return await stripeV2Fetch<StripeAccountV2>({
    method: "POST",
    path: `/v2/core/accounts/${accountId}`,
    include: ["configuration.merchant", "configuration.recipient", "identity", "requirements"],
    body: {
      defaults: {
        responsibilities: {
          ...(updates.feesCollector ? { fees_collector: updates.feesCollector } : {}),
        },
      },
    },
  });
}

export async function listStripeAccountPersonsV2(accountId: string) {
  return await stripeV2Fetch<{
    data?: StripeAccountPersonV2[] | null;
  }>({
    method: "GET",
    path: `/v2/core/accounts/${accountId}/persons`,
  });
}

export async function getStripeRepresentativeNameV2(accountId: string) {
  const response = await listStripeAccountPersonsV2(accountId);
  const people = response.data ?? [];
  const representative =
    people.find((person) => person.relationship?.representative) ??
    people.find((person) => person.relationship?.owner) ??
    people[0];

  if (!representative) {
    return null;
  }

  const firstName = representative.given_name?.trim() || undefined;
  const lastName = representative.surname?.trim() || undefined;
  const legalName = [firstName, lastName].filter(Boolean).join(" ").trim() || undefined;

  if (!firstName && !lastName && !legalName) {
    return null;
  }

  return {
    firstName,
    lastName,
    legalName,
  };
}

export async function createStripeAccountLinkV2(input: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
}) {
  return await stripeV2Fetch<{
    url: string;
    expires_at?: string | null;
  }>({
    method: "POST",
    path: "/v2/core/account_links",
    body: {
      account: input.accountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          configurations: ["merchant", "recipient"],
          refresh_url: input.refreshUrl,
          return_url: input.returnUrl,
        },
      },
    },
  });
}

export async function createStripeAccountSessionV2(input: {
  accountId: string;
  enableOnboarding?: boolean;
  enablePayouts?: boolean;
}) {
  const secretKey = requireStripeSecretKey();
  const stripe = new StripeSDK(secretKey);
  const account = await retrieveStripeAccountV2(input.accountId);
  const disableStripeUserAuthentication =
    account.dashboard === "none" &&
    account.defaults?.responsibilities?.requirements_collector === "application";
  const response = await stripe.accountSessions.create({
    account: input.accountId,
    components: {
      ...(input.enableOnboarding !== false
        ? {
            account_onboarding: {
              enabled: true,
              ...(disableStripeUserAuthentication
                ? {
                    features: {
                      disable_stripe_user_authentication: true,
                    },
                  }
                : {}),
            },
          }
        : {}),
      ...(input.enablePayouts !== false
        ? {
            payouts: {
              enabled: true,
              features: {
                ...(disableStripeUserAuthentication
                  ? {
                      disable_stripe_user_authentication: true,
                    }
                  : {}),
                standard_payouts: true,
                edit_payout_schedule: true,
                external_account_collection: true,
              },
            },
          }
        : {}),
    },
  });
  if (!response.client_secret) {
    throw new Error("Stripe account session did not return a client secret");
  }

  return {
    clientSecret: response.client_secret,
  };
}
