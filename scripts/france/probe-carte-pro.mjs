#!/usr/bin/env node

const DEFAULT_CARD = "00410ED0012";
const cards = process.argv.slice(2);
const targets = cards.length > 0 ? cards : [DEFAULT_CARD, "99999ED9999"];

function normalizeCard(cardNumber) {
  const normalized = String(cardNumber)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z0-9]{11}$/.test(normalized)) {
    throw new Error(`Invalid France carte professionnelle number: ${cardNumber}`);
  }
  return normalized;
}

function parseSlashDateToIso(value) {
  const match = String(value || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : undefined;
}

function parseIsoDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : undefined;
}

async function lookup(cardNumber) {
  const normalized = normalizeCard(cardNumber);
  const url = new URL("/api/Educateur/GetPubliEdu", "https://eme-api-core.sports.gouv.fr");
  url.searchParams.set("numCartePro", normalized);
  url.searchParams.set("identifiant", "");
  url.searchParams.set("isStagiaire", "false");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json, text/plain, */*",
      Origin: "https://recherche-educateur.sports.gouv.fr",
      Referer: "https://recherche-educateur.sports.gouv.fr/",
      "User-Agent": "Mozilla/5.0 Queue-France-Registry-Probe/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${url}`);
  }

  const data = await response.json();
  return {
    queriedIdentifier: cardNumber,
    normalizedIdentifier: normalized,
    apiUrl: url.toString(),
    publicProfileUrl: `https://recherche-educateur.sports.gouv.fr/CartePro/${normalized}`,
    status: data?.errorCode === "NOT_FOUND" || data?.affichePublic !== true ? "not_found" : "found",
    hasValidRegistration: data?.hasValid === true,
    isPublic: data?.affichePublic === true,
    holder:
      data?.prenom || data?.nom
        ? {
            firstName: data?.prenom ?? undefined,
            lastName: data?.nom ?? undefined,
            fullName: [data?.prenom, data?.nom].filter(Boolean).join(" "),
          }
        : undefined,
    issuingAuthority: data?.delivreePar ?? undefined,
    expiresOn: parseSlashDateToIso(data?.expiration),
    qualifications: Array.isArray(data?.listQualifs)
      ? data.listQualifs.map((qualification) => ({
          title: qualification?.titre,
          obtainedOn: parseIsoDate(qualification?.dateObtention),
          lastReviewedOn: parseIsoDate(qualification?.dateDerniereRevision),
          renewalRequiredByOn: parseIsoDate(qualification?.recyclageAvantLe),
          conditions: qualification?.conditionsExercice,
        }))
      : [],
    errorCode: data?.errorCode ?? undefined,
    errorMessage: data?.errorMessage ?? undefined,
  };
}

for (const target of targets) {
  try {
    const result = await lookup(target);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          queriedIdentifier: target,
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }
}
