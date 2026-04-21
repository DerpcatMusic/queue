export const FRANCE_REGISTRY_COUNTRY_CODE = "FR" as const;
export const FRANCE_REGISTRY_PROVIDER = "france_eaps_public" as const;
export const FRANCE_PUBLIC_REGISTRY_ORIGIN = "https://recherche-educateur.sports.gouv.fr";
export const FRANCE_PUBLIC_REGISTRY_API_BASE = "https://eme-api-core.sports.gouv.fr";

export type FranceProfessionalQualification = {
  title: string;
  alert?: string;
  conditions?: string;
  obtainedOn?: string;
  obtainedAt?: number;
  validFromOn?: string;
  validFromAt?: number;
  validUntilOn?: string;
  validUntilAt?: number;
  lastReviewedOn?: string;
  lastReviewedAt?: number;
  renewalRequiredByOn?: string;
  renewalRequiredByAt?: number;
};

export type FranceProfessionalCardLookupResult = {
  country: typeof FRANCE_REGISTRY_COUNTRY_CODE;
  provider: typeof FRANCE_REGISTRY_PROVIDER;
  status: "found" | "not_found";
  queriedIdentifier: string;
  normalizedIdentifier: string;
  apiUrl: string;
  publicProfileUrl: string;
  checkedAt: number;
  isPublic: boolean;
  hasValidRegistration: boolean;
  holder?: {
    firstName?: string;
    lastName?: string;
    fullName: string;
  };
  issuingAuthority?: string;
  expiresOn?: string;
  expiresAt?: number;
  qualifications: FranceProfessionalQualification[];
  errorCode?: string;
  errorMessage?: string;
  registryFlags: {
    isStagiaire: boolean;
    isLPS: boolean;
    isTitulaireDiplome: boolean;
    hasRecycleNotice: boolean;
  };
};

type FranceProfessionalCardApiQualification = {
  alerte?: string | null;
  titre?: string | null;
  dateObtention?: string | null;
  dateDebut?: string | null;
  dateFin?: string | null;
  dateDerniereRevision?: string | null;
  recyclageAvantLe?: string | null;
  conditionsExercice?: string | null;
};

type FranceProfessionalCardApiResponse = {
  isTitulaireDiplome?: boolean;
  isStagiaire?: boolean;
  isLPS?: boolean;
  prenom?: string | null;
  nom?: string | null;
  cartePro?: string | null;
  expiration?: string | null;
  delivreePar?: string | null;
  recyclage?: string | null;
  listQualifs?: FranceProfessionalCardApiQualification[] | null;
  affichePublic?: boolean;
  hasValid?: boolean;
  errorCode?: string | null;
  errorMessage?: string | null;
};

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function parseSlashDateToParts(value: string | undefined) {
  const match = value?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return undefined;
  }
  const [, day, month, year] = match;
  return {
    iso: `${year}-${month}-${day}`,
    at: Date.UTC(Number(year), Number(month) - 1, Number(day), 23, 59, 59, 999),
  };
}

function parseIsoDateToParts(value: string | undefined) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return undefined;
  }
  const [, year, month, day] = match;
  return {
    iso: `${year}-${month}-${day}`,
    at: Date.UTC(Number(year), Number(month) - 1, Number(day), 23, 59, 59, 999),
  };
}

function mapQualification(
  qualification: FranceProfessionalCardApiQualification,
): FranceProfessionalQualification | null {
  const title = normalizeOptionalText(qualification.titre);
  if (!title) {
    return null;
  }

  const obtained = parseIsoDateToParts(normalizeOptionalText(qualification.dateObtention));
  const validFrom = parseIsoDateToParts(normalizeOptionalText(qualification.dateDebut));
  const validUntil = parseIsoDateToParts(normalizeOptionalText(qualification.dateFin));
  const lastReviewed = parseIsoDateToParts(
    normalizeOptionalText(qualification.dateDerniereRevision),
  );
  const renewal = parseIsoDateToParts(normalizeOptionalText(qualification.recyclageAvantLe));
  const alert = normalizeOptionalText(qualification.alerte);
  const conditions = normalizeOptionalText(qualification.conditionsExercice);

  return {
    title,
    ...(alert ? { alert } : {}),
    ...(conditions ? { conditions } : {}),
    ...(obtained ? { obtainedOn: obtained.iso, obtainedAt: obtained.at } : {}),
    ...(validFrom ? { validFromOn: validFrom.iso, validFromAt: validFrom.at } : {}),
    ...(validUntil ? { validUntilOn: validUntil.iso, validUntilAt: validUntil.at } : {}),
    ...(lastReviewed ? { lastReviewedOn: lastReviewed.iso, lastReviewedAt: lastReviewed.at } : {}),
    ...(renewal ? { renewalRequiredByOn: renewal.iso, renewalRequiredByAt: renewal.at } : {}),
  };
}

export function normalizeFranceProfessionalCardNumber(cardNumber: string) {
  const normalized = cardNumber
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z0-9]{11}$/.test(normalized)) {
    throw new Error("France carte professionnelle numbers must be 11 alphanumeric characters");
  }
  return normalized;
}

export function buildFranceProfessionalCardApiUrl(cardNumber: string) {
  const normalized = normalizeFranceProfessionalCardNumber(cardNumber);
  const url = new URL("/api/Educateur/GetPubliEdu", FRANCE_PUBLIC_REGISTRY_API_BASE);
  url.searchParams.set("numCartePro", normalized);
  url.searchParams.set("identifiant", "");
  url.searchParams.set("isStagiaire", "false");
  return url.toString();
}

export function buildFranceProfessionalCardPublicProfileUrl(cardNumber: string) {
  const normalized = normalizeFranceProfessionalCardNumber(cardNumber);
  return new URL(`/CartePro/${normalized}`, FRANCE_PUBLIC_REGISTRY_ORIGIN).toString();
}

export function mapFranceProfessionalCardResponse(args: {
  queriedIdentifier: string;
  response: FranceProfessionalCardApiResponse;
  checkedAt?: number;
}): FranceProfessionalCardLookupResult {
  const normalizedIdentifier = normalizeFranceProfessionalCardNumber(args.queriedIdentifier);
  const checkedAt = args.checkedAt ?? Date.now();
  const expires = parseSlashDateToParts(normalizeOptionalText(args.response.expiration));
  const firstName = normalizeOptionalText(args.response.prenom);
  const lastName = normalizeOptionalText(args.response.nom);
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const isFound =
    args.response.errorCode !== "NOT_FOUND" &&
    args.response.affichePublic === true &&
    normalizeOptionalText(args.response.cartePro) === normalizedIdentifier;

  return {
    country: FRANCE_REGISTRY_COUNTRY_CODE,
    provider: FRANCE_REGISTRY_PROVIDER,
    status: isFound ? "found" : "not_found",
    queriedIdentifier: args.queriedIdentifier,
    normalizedIdentifier,
    apiUrl: buildFranceProfessionalCardApiUrl(normalizedIdentifier),
    publicProfileUrl: buildFranceProfessionalCardPublicProfileUrl(normalizedIdentifier),
    checkedAt,
    isPublic: args.response.affichePublic === true,
    hasValidRegistration: args.response.hasValid === true,
    ...(fullName
      ? {
          holder: {
            ...(firstName ? { firstName } : {}),
            ...(lastName ? { lastName } : {}),
            fullName,
          },
        }
      : {}),
    ...(normalizeOptionalText(args.response.delivreePar)
      ? { issuingAuthority: normalizeOptionalText(args.response.delivreePar) }
      : {}),
    ...(expires ? { expiresOn: expires.iso, expiresAt: expires.at } : {}),
    qualifications: (args.response.listQualifs ?? [])
      .map(mapQualification)
      .filter(Boolean) as FranceProfessionalQualification[],
    ...(normalizeOptionalText(args.response.errorCode)
      ? { errorCode: normalizeOptionalText(args.response.errorCode) }
      : {}),
    ...(normalizeOptionalText(args.response.errorMessage)
      ? { errorMessage: normalizeOptionalText(args.response.errorMessage) }
      : {}),
    registryFlags: {
      isStagiaire: args.response.isStagiaire === true,
      isLPS: args.response.isLPS === true,
      isTitulaireDiplome: args.response.isTitulaireDiplome === true,
      hasRecycleNotice: normalizeOptionalText(args.response.recyclage) !== undefined,
    },
  };
}

export async function lookupFranceProfessionalCardPublic(
  cardNumber: string,
): Promise<FranceProfessionalCardLookupResult> {
  const apiUrl = buildFranceProfessionalCardApiUrl(cardNumber);
  const response = await fetch(apiUrl, {
    headers: {
      Accept: "application/json, text/plain, */*",
      Origin: FRANCE_PUBLIC_REGISTRY_ORIGIN,
      Referer: `${FRANCE_PUBLIC_REGISTRY_ORIGIN}/`,
      "User-Agent": "Mozilla/5.0 Queue-France-Registry-Verification/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`France registry lookup failed with HTTP ${response.status}`);
  }

  const data = (await response.json()) as FranceProfessionalCardApiResponse;
  return mapFranceProfessionalCardResponse({
    queriedIdentifier: cardNumber,
    response: data,
  });
}
