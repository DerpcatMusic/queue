import { ConvexError } from "convex/values";
import { ErrorCode } from "./errors";

export type StudioBusinessLookupCountry = "FR" | "DE" | "UK";

export type StudioBusinessAddress = {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country?: string;
};

export type StudioBusinessLookupResult = {
  country: StudioBusinessLookupCountry;
  provider: "vies" | "companies_house" | "api_entreprise";
  status: "found" | "not_found";
  queriedIdentifier: string;
  normalizedIdentifier: string;
  sourceUrl: string;
  checkedAt: number;
  legalBusinessName?: string;
  taxId?: string;
  companyRegNumber?: string;
  legalForm?: string;
  billingAddress?: string;
  billingAddressStructured?: StudioBusinessAddress;
  notes?: string[];
};

const VIES_ENDPOINT = "https://ec.europa.eu/taxation_customs/vies/services/checkVatService";
const COMPANIES_HOUSE_API_BASE = "https://api.company-information.service.gov.uk";
const ENTREPRISE_API_BASE = "https://entreprises.api.gouv.fr/api/v3";

function normalizeFreeText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function normalizeBusinessAddressLine(value: string | undefined) {
  const normalized = normalizeFreeText(value);
  return normalized ? normalized.replace(/\s+/g, " ") : undefined;
}

function formatAddress(parts: Array<string | undefined>) {
  return parts
    .map(normalizeBusinessAddressLine)
    .filter((part): part is string => Boolean(part))
    .join(", ");
}

function parseViesXmlValue(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<(?:[^:>]+:)?${tag}>([\\s\\S]*?)</(?:[^:>]+:)?${tag}>`, "i"));
  if (!match) {
    return undefined;
  }
  const value = match[1]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function normalizeVatNumber(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeCompanyNumber(value: string) {
  return value.trim().toUpperCase().replace(/[\s-]/g, "");
}

function isFrenchSiren(value: string) {
  return /^\d{9}$/.test(value);
}

function isFrenchSiret(value: string) {
  return /^\d{14}$/.test(value);
}

function isVatLike(value: string, country: "FR" | "DE" | "UK") {
  switch (country) {
    case "FR":
      return /^FR[A-Z0-9]{2}\d{9}$/.test(value) || /^\d{9}$/.test(value) || /^\d{14}$/.test(value);
    case "DE":
      return /^DE\d{9}$/.test(value);
    case "UK":
      return /^XI\d{9,12}$/.test(value) || /^GB\d{9}$/.test(value);
  }
}

function getEntreprisesApiToken() {
  const token = process.env.ENTREPRISE_API_TOKEN?.trim();
  if (!token) {
    throw new ConvexError({
      code: ErrorCode.MISSING_CONFIGURATION,
      message: "ENTREPRISE_API_TOKEN is not configured",
    });
  }
  return token;
}

async function fetchEntreprisesJson<T>(path: string) {
  const token = getEntreprisesApiToken();
  const response = await fetch(`${ENTREPRISE_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "User-Agent": "Queue-Studio-Business-Lookup/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`API Entreprise lookup failed with HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

function isExplicitVatNumber(value: string) {
  return (
    /^FR[A-Z0-9]{2}\d{9}$/.test(value) || /^DE\d{9}$/.test(value) || /^XI\d{9,12}$/.test(value)
  );
}

function deriveFrenchVatFromSiren(sirenOrSiret: string) {
  const siren = isFrenchSiret(sirenOrSiret) ? sirenOrSiret.slice(0, 9) : sirenOrSiret;
  if (!isFrenchSiren(siren)) {
    return undefined;
  }

  const sirenNumber = Number.parseInt(siren, 10);
  if (!Number.isFinite(sirenNumber)) {
    return undefined;
  }

  const key = (12 + 3 * (sirenNumber % 97)) % 97;
  return `FR${String(key).padStart(2, "0")}${siren}`;
}

function normalizeFrenchIdentifier(args: {
  taxId?: string | undefined;
  companyRegNumber?: string | undefined;
}) {
  const taxId = normalizeVatNumber(args.taxId ?? "");
  if (/^FR[A-Z0-9]{2}\d{9}$/.test(taxId)) {
    return taxId;
  }

  const companyRegNumber = normalizeVatNumber(args.companyRegNumber ?? "");
  const derivedVat = deriveFrenchVatFromSiren(taxId || companyRegNumber);
  if (derivedVat) {
    return derivedVat;
  }

  return undefined;
}

async function lookupViesVatNumber(args: { countryCode: "FR" | "DE" | "UK"; vatNumber: string }) {
  const normalized = normalizeVatNumber(args.vatNumber);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:ec.europa.eu:taxud:vies:services:checkVat:types">
  <soapenv:Header/>
  <soapenv:Body>
    <urn:checkVat>
      <urn:countryCode>${args.countryCode === "UK" ? "XI" : args.countryCode}</urn:countryCode>
      <urn:vatNumber>${normalized.replace(/^[A-Z]{2}/, "")}</urn:vatNumber>
    </urn:checkVat>
  </soapenv:Body>
</soapenv:Envelope>`;

  const response = await fetch(VIES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "",
      Accept: "text/xml, application/xml, */*",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`VIES lookup failed with HTTP ${response.status}`);
  }

  const xml = await response.text();
  const valid = parseViesXmlValue(xml, "valid") === "true";
  const name = normalizeFreeText(parseViesXmlValue(xml, "name"));
  const address = normalizeFreeText(parseViesXmlValue(xml, "address"));

  return {
    valid,
    name,
    address,
    sourceUrl: VIES_ENDPOINT,
    notes: [
      args.countryCode === "UK"
        ? "Validated through EU VIES using the Northern Ireland XI prefix when applicable."
        : "Validated through EU VIES.",
    ],
  };
}

function getCompaniesHouseApiKey() {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY?.trim();
  if (!apiKey) {
    throw new ConvexError({
      code: ErrorCode.MISSING_CONFIGURATION,
      message: "COMPANIES_HOUSE_API_KEY is not configured",
    });
  }
  return apiKey;
}

async function fetchCompaniesHouseJson<T>(path: string) {
  const apiKey = getCompaniesHouseApiKey();
  const auth = Buffer.from(`${apiKey}:`).toString("base64");
  const response = await fetch(`${COMPANIES_HOUSE_API_BASE}${path}`, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      "User-Agent": "Queue-Studio-Business-Lookup/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Companies House lookup failed with HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

type CompaniesHouseSearchResponse = {
  items?: Array<{
    company_number: string;
    title: string;
    company_status?: string;
  }>;
};

type CompaniesHouseProfileResponse = {
  company_name?: string;
  company_number?: string;
  company_type?: string;
  company_status?: string;
  registered_office_address?: {
    care_of?: string;
    po_box?: string;
    premises?: string;
    address_line_1?: string;
    address_line_2?: string;
    locality?: string;
    region?: string;
    postal_code?: string;
    country?: string;
  };
};

function formatCompaniesHouseAddress(
  address: NonNullable<CompaniesHouseProfileResponse["registered_office_address"]>,
) {
  return formatAddress([
    address.premises,
    address.address_line_1,
    address.address_line_2,
    address.locality,
    address.region,
    address.postal_code,
    address.country,
  ]);
}

async function lookupCompaniesHouseCompany(args: {
  companyNumber?: string | undefined;
  companyName?: string | undefined;
}) {
  const companyNumber = normalizeCompanyNumber(args.companyNumber ?? "");
  let resolvedCompanyNumber = companyNumber;
  let didFallbackToSearch = false;

  if (!resolvedCompanyNumber) {
    const companyName = normalizeFreeText(args.companyName);
    if (!companyName) {
      return null;
    }

    const search = await fetchCompaniesHouseJson<CompaniesHouseSearchResponse>(
      `/search/companies?q=${encodeURIComponent(companyName)}&items_per_page=10`,
    );
    const selected = (search.items ?? [])
      .filter((item) => item.company_status !== "dissolved")
      .sort((left, right) => {
        const leftExact = left.title.toLowerCase() === companyName.toLowerCase() ? 1 : 0;
        const rightExact = right.title.toLowerCase() === companyName.toLowerCase() ? 1 : 0;
        if (leftExact !== rightExact) {
          return rightExact - leftExact;
        }
        return left.title.localeCompare(right.title);
      })[0];

    if (!selected) {
      return null;
    }
    resolvedCompanyNumber = selected.company_number;
  }

  let profile: CompaniesHouseProfileResponse;
  try {
    profile = await fetchCompaniesHouseJson<CompaniesHouseProfileResponse>(
      `/company/${resolvedCompanyNumber}`,
    );
  } catch (error) {
    if (!args.companyName || didFallbackToSearch) {
      throw error;
    }

    const search = await fetchCompaniesHouseJson<CompaniesHouseSearchResponse>(
      `/search/companies?q=${encodeURIComponent(args.companyName.trim())}&items_per_page=10`,
    );
    const selected = (search.items ?? [])
      .filter((item) => item.company_status !== "dissolved")
      .sort((left, right) => {
        const leftExact =
          left.title.toLowerCase() === args.companyName?.trim().toLowerCase() ? 1 : 0;
        const rightExact =
          right.title.toLowerCase() === args.companyName?.trim().toLowerCase() ? 1 : 0;
        if (leftExact !== rightExact) {
          return rightExact - leftExact;
        }
        return left.title.localeCompare(right.title);
      })[0];

    if (!selected) {
      throw error;
    }

    didFallbackToSearch = true;
    resolvedCompanyNumber = selected.company_number;
    profile = await fetchCompaniesHouseJson<CompaniesHouseProfileResponse>(
      `/company/${resolvedCompanyNumber}`,
    );
  }

  const address = profile.registered_office_address;
  const formattedAddress = address ? formatCompaniesHouseAddress(address) : undefined;
  const line1 = address ? normalizeFreeText(address.premises || address.address_line_1) : undefined;
  const city = address ? normalizeFreeText(address.locality) : undefined;
  const postalCode = address ? normalizeFreeText(address.postal_code) : undefined;
  const addressStructured =
    line1 && city && postalCode && address
      ? {
          line1,
          ...(normalizeFreeText(address.address_line_2)
            ? { line2: normalizeFreeText(address.address_line_2) }
            : {}),
          city,
          ...(normalizeFreeText(address.region)
            ? { state: normalizeFreeText(address.region) }
            : {}),
          postalCode,
          ...(normalizeFreeText(address.country)
            ? { country: normalizeFreeText(address.country) }
            : {}),
        }
      : undefined;

  return {
    company_name: normalizeFreeText(profile.company_name) ?? resolvedCompanyNumber,
    company_number: normalizeFreeText(profile.company_number) ?? resolvedCompanyNumber,
    company_type: normalizeFreeText(profile.company_type),
    company_status: normalizeFreeText(profile.company_status),
    registered_office_address: formattedAddress,
    registered_office_address_structured: addressStructured,
  };
}

type FranceUniteLegaleResponse = {
  data?: {
    siren?: string;
    siret_siege_social?: string;
    type?: string;
    personne_morale_attributs?: {
      raison_sociale?: string;
      sigle?: string;
    };
    personne_physique_attributs?: {
      nom_usage?: string;
      prenom_usuel?: string;
      pseudonyme?: string;
    };
    forme_juridique?: {
      libelle?: string;
    };
  };
};

type FranceEtablissementAdresseResponse = {
  data?: {
    numero_voie?: string;
    indice_repetition_voie?: string;
    type_voie?: string;
    libelle_voie?: string;
    complement_adresse?: string;
    distribution_speciale?: string;
    code_postal?: string;
    libelle_commune?: string;
    libelle_commune_etranger?: string;
    libelle_pays_etranger?: string;
    acheminement_postal?: {
      l1?: string;
      l2?: string;
      l3?: string;
      l4?: string;
      l5?: string;
      l6?: string;
      l7?: string;
    };
  };
};

type FranceVatNumberResponse = {
  data?: {
    numero_tva_intracommunautaire?: string;
    numero_tva?: string;
  };
};

async function lookupFranceBusinessRegistry(args: {
  taxId?: string | undefined;
  companyRegNumber?: string | undefined;
  legalBusinessName?: string | undefined;
}): Promise<StudioBusinessLookupResult | null> {
  const companyRegNumber = normalizeCompanyNumber(args.companyRegNumber ?? "");
  const taxId = normalizeVatNumber(args.taxId ?? "");
  const siren =
    (isFrenchSiret(companyRegNumber) ? companyRegNumber.slice(0, 9) : undefined) ??
    (isFrenchSiren(companyRegNumber) ? companyRegNumber : undefined) ??
    normalizeFrenchIdentifier({
      taxId: args.taxId,
      companyRegNumber: args.companyRegNumber,
    })?.slice(4) ??
    (isVatLike(taxId, "FR") && taxId.length >= 11 ? taxId.slice(-9) : undefined);

  if (!siren) {
    return null;
  }

  try {
    const [unitLegal, vatLookup] = await Promise.all([
      fetchEntreprisesJson<FranceUniteLegaleResponse>(`/insee/unites_legales/${siren}`),
      fetchEntreprisesJson<FranceVatNumberResponse>(`/commission_europeenne/numero_tva/${siren}`),
    ]);

    const siretSiege = normalizeFreeText(unitLegal.data?.siret_siege_social);
    const addressLookup = siretSiege
      ? await fetchEntreprisesJson<FranceEtablissementAdresseResponse>(
          `/insee/etablissements/${siretSiege}/adresse`,
        )
      : null;

    const legalBusinessName =
      normalizeFreeText(unitLegal.data?.personne_morale_attributs?.raison_sociale) ??
      normalizeFreeText(unitLegal.data?.personne_physique_attributs?.pseudonyme) ??
      normalizeFreeText(unitLegal.data?.personne_physique_attributs?.prenom_usuel) ??
      normalizeFreeText(unitLegal.data?.personne_physique_attributs?.nom_usage) ??
      args.legalBusinessName?.trim();
    const legalForm = normalizeFreeText(unitLegal.data?.forme_juridique?.libelle);
    const taxIdValue =
      normalizeFreeText(vatLookup.data?.numero_tva_intracommunautaire) ??
      normalizeFreeText(vatLookup.data?.numero_tva) ??
      deriveFrenchVatFromSiren(siren);

    const addressData = addressLookup?.data;
    const line1 = normalizeBusinessAddressLine(
      [
        addressData?.numero_voie,
        addressData?.indice_repetition_voie,
        addressData?.type_voie,
        addressData?.libelle_voie,
      ]
        .filter(Boolean)
        .join(" "),
    );
    const line2 = normalizeBusinessAddressLine(
      addressData?.complement_adresse ??
        addressData?.distribution_speciale ??
        addressData?.acheminement_postal?.l2,
    );
    const city = normalizeFreeText(
      addressData?.libelle_commune ??
        addressData?.libelle_commune_etranger ??
        addressData?.acheminement_postal?.l6,
    );
    const postalCode = normalizeFreeText(addressData?.code_postal);
    const country =
      normalizeFreeText(addressData?.libelle_pays_etranger) ??
      normalizeFreeText(addressData?.acheminement_postal?.l7) ??
      "France";
    const structuredAddress =
      line1 && city && postalCode
        ? {
            line1,
            ...(line2 ? { line2 } : {}),
            city,
            postalCode,
            ...(country ? { country } : {}),
          }
        : undefined;
    const formattedAddress = structuredAddress
      ? formatAddress([
          structuredAddress.line1,
          structuredAddress.line2,
          structuredAddress.city,
          structuredAddress.postalCode,
          structuredAddress.country,
        ])
      : normalizeFreeText(addressData?.acheminement_postal?.l1)
        ? formatAddress([
            addressData?.acheminement_postal?.l1,
            addressData?.acheminement_postal?.l2,
            addressData?.acheminement_postal?.l3,
            addressData?.acheminement_postal?.l4,
            addressData?.acheminement_postal?.l5,
            addressData?.acheminement_postal?.l6,
            addressData?.acheminement_postal?.l7,
          ])
        : undefined;

    return {
      country: "FR" as const,
      provider: "api_entreprise" as const,
      status: "found" as const,
      queriedIdentifier:
        [args.taxId, args.companyRegNumber, args.legalBusinessName]
          .map((value) => value?.trim())
          .find((value) => Boolean(value)) ?? siren,
      normalizedIdentifier: siren,
      sourceUrl: `${ENTREPRISE_API_BASE}/insee/unites_legales/${siren}`,
      checkedAt: Date.now(),
      ...(legalBusinessName ? { legalBusinessName } : {}),
      ...(taxIdValue ? { taxId: taxIdValue } : {}),
      ...(siren ? { companyRegNumber: siren } : {}),
      ...(legalForm ? { legalForm } : {}),
      ...(formattedAddress ? { billingAddress: formattedAddress } : {}),
      ...(structuredAddress ? { billingAddressStructured: structuredAddress } : {}),
      notes: [
        addressLookup ? undefined : "Address lookup was not available for this company.",
        vatLookup?.data?.numero_tva_intracommunautaire
          ? undefined
          : "VAT number was derived from the SIREN.",
      ].filter(Boolean) as string[],
    };
  } catch {
    return null;
  }
}

export async function lookupStudioBusinessIdentity(args: {
  country: StudioBusinessLookupCountry;
  legalBusinessName?: string | undefined;
  taxId?: string | undefined;
  companyRegNumber?: string | undefined;
}) {
  const normalizedCountry = args.country === "UK" ? "GB" : args.country;
  const lookupCountry = normalizedCountry === "GB" ? "UK" : normalizedCountry;
  const queriedIdentifier = [args.taxId, args.companyRegNumber, args.legalBusinessName]
    .map((value) => value?.trim())
    .find((value) => Boolean(value));

  if (!queriedIdentifier) {
    throw new ConvexError("Add a tax ID, company number, or business name first");
  }

  const checkedAt = Date.now();

  if (lookupCountry === "FR") {
    const franceLookup = await lookupFranceBusinessRegistry({
      taxId: args.taxId,
      companyRegNumber: args.companyRegNumber,
      legalBusinessName: args.legalBusinessName,
    });

    if (franceLookup) {
      return franceLookup;
    }
  }

  if (lookupCountry === "UK") {
    const company = await lookupCompaniesHouseCompany({
      companyNumber: args.companyRegNumber,
      companyName: args.legalBusinessName,
    });

    if (!company) {
      return {
        country: "UK" as const,
        provider: "companies_house" as const,
        status: "not_found" as const,
        queriedIdentifier,
        normalizedIdentifier: queriedIdentifier,
        sourceUrl: `${COMPANIES_HOUSE_API_BASE}/search/companies`,
        checkedAt,
        notes: ["No Companies House record matched the current business name or company number."],
      };
    }

    return {
      country: "UK" as const,
      provider: "companies_house" as const,
      status: "found" as const,
      queriedIdentifier,
      normalizedIdentifier: company.company_number ?? queriedIdentifier,
      sourceUrl: `${COMPANIES_HOUSE_API_BASE}/company/${company.company_number}`,
      checkedAt,
      legalBusinessName: company.company_name,
      companyRegNumber: company.company_number,
      billingAddress: company.registered_office_address,
      billingAddressStructured: company.registered_office_address_structured,
      legalForm: company.company_type,
      notes: [
        company.company_status ? `Companies House status: ${company.company_status}` : undefined,
      ].filter(Boolean) as string[],
    };
  }

  const viesVatNumber =
    normalizeFrenchIdentifier({
      taxId: args.taxId,
      companyRegNumber: args.companyRegNumber,
    }) ??
    (isVatLike(normalizeVatNumber(args.taxId ?? ""), lookupCountry as "FR" | "DE" | "UK")
      ? normalizeVatNumber(args.taxId ?? "")
      : undefined);
  const explicitVatNumber = normalizeVatNumber(args.taxId ?? "");

  if (!viesVatNumber) {
    throw new ConvexError(
      lookupCountry === "FR"
        ? "Enter a SIREN, SIRET, or FR VAT number to autofill French studio details"
        : "Enter a VAT number to autofill German studio details",
    );
  }

  const viesResult = await lookupViesVatNumber({
    countryCode: lookupCountry as "FR" | "DE" | "UK",
    vatNumber: viesVatNumber,
  });

  if (!viesResult.valid) {
    return {
      country: lookupCountry as "FR" | "DE" | "UK",
      provider: "vies" as const,
      status: "not_found" as const,
      queriedIdentifier,
      normalizedIdentifier: viesVatNumber,
      sourceUrl: viesResult.sourceUrl,
      checkedAt,
      notes: viesResult.notes,
    };
  }

  const formattedAddress = viesResult.address;
  const addressStructured = formattedAddress
    ? (() => {
        const parts = formattedAddress
          .split(/\r?\n|,/)
          .map((part) => part.trim())
          .filter(Boolean);
        const [line1, line2, city, state, postalCode, country] = parts;
        if (!line1 || !city || !postalCode) {
          return undefined;
        }
        return {
          line1,
          ...(line2 ? { line2 } : {}),
          city,
          ...(state ? { state } : {}),
          postalCode,
          ...(country ? { country } : {}),
        } satisfies StudioBusinessAddress;
      })()
    : undefined;

  return {
    country: lookupCountry as "FR" | "DE" | "UK",
    provider: "vies" as const,
    status: "found" as const,
    queriedIdentifier,
    normalizedIdentifier: viesVatNumber,
    sourceUrl: viesResult.sourceUrl,
    checkedAt,
    ...(viesResult.name ? { legalBusinessName: viesResult.name } : {}),
    ...(isExplicitVatNumber(explicitVatNumber) ? { taxId: explicitVatNumber } : {}),
    ...(formattedAddress ? { billingAddress: formattedAddress } : {}),
    ...(addressStructured ? { billingAddressStructured: addressStructured } : {}),
    notes: viesResult.notes,
  };
}
