import {
  type FranceProfessionalCardLookupResult,
  lookupFranceProfessionalCardPublic,
} from "./professionalRegistryFrance";

export type ProfessionalRegistryCountryCode = "FR";
export type PublicProfessionalRegistryLookupResult = FranceProfessionalCardLookupResult;

export async function lookupPublicProfessionalRegistryRecord(args: {
  country: ProfessionalRegistryCountryCode;
  identifier: string;
}): Promise<PublicProfessionalRegistryLookupResult> {
  switch (args.country) {
    case "FR":
      return await lookupFranceProfessionalCardPublic(args.identifier);
    default: {
      const exhaustiveCheck: never = args.country;
      throw new Error(`Unsupported professional registry country: ${exhaustiveCheck}`);
    }
  }
}
