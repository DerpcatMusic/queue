import { describe, expect, it } from "bun:test";

import {
  buildFranceProfessionalCardApiUrl,
  buildFranceProfessionalCardPublicProfileUrl,
  mapFranceProfessionalCardResponse,
  normalizeFranceProfessionalCardNumber,
} from "./professionalRegistryFrance";

describe("normalizeFranceProfessionalCardNumber", () => {
  it("normalizes casing and separators", () => {
    expect(normalizeFranceProfessionalCardNumber("00410-ed-0012")).toBe("00410ED0012");
  });

  it("rejects malformed identifiers", () => {
    expect(() => normalizeFranceProfessionalCardNumber("bad-card")).toThrow();
  });
});

describe("France professional registry URLs", () => {
  it("builds the direct API lookup URL", () => {
    expect(buildFranceProfessionalCardApiUrl("00410ED0012")).toBe(
      "https://eme-api-core.sports.gouv.fr/api/Educateur/GetPubliEdu?numCartePro=00410ED0012&identifiant=&isStagiaire=false",
    );
  });

  it("builds the public profile URL", () => {
    expect(buildFranceProfessionalCardPublicProfileUrl("00410ED0012")).toBe(
      "https://recherche-educateur.sports.gouv.fr/CartePro/00410ED0012",
    );
  });
});

describe("mapFranceProfessionalCardResponse", () => {
  it("maps a found card response into the normalized shape", () => {
    const result = mapFranceProfessionalCardResponse({
      queriedIdentifier: "00410ED0012",
      checkedAt: 1,
      response: {
        isTitulaireDiplome: false,
        isStagiaire: false,
        isLPS: false,
        prenom: "Samuel",
        nom: "GILLET",
        cartePro: "00410ED0012",
        expiration: "17/06/2030",
        delivreePar: "SDJES ALPES de HAUTE PROVENCE",
        affichePublic: true,
        hasValid: true,
        listQualifs: [
          {
            titre: "BEES 1 - SKI ALPIN",
            dateObtention: "2010-04-22",
            conditionsExercice: "Enseignement et entraînement en ski alpin",
          },
        ],
      },
    });

    expect(result.status).toBe("found");
    expect(result.hasValidRegistration).toBe(true);
    expect(result.holder?.fullName).toBe("Samuel GILLET");
    expect(result.expiresOn).toBe("2030-06-17");
    expect(result.qualifications).toHaveLength(1);
    expect(result.qualifications[0]?.title).toBe("BEES 1 - SKI ALPIN");
    expect(result.qualifications[0]?.obtainedOn).toBe("2010-04-22");
  });

  it("maps NOT_FOUND responses cleanly", () => {
    const result = mapFranceProfessionalCardResponse({
      queriedIdentifier: "99999ED9999",
      checkedAt: 1,
      response: {
        affichePublic: false,
        hasValid: false,
        cartePro: null,
        listQualifs: null,
        errorCode: "NOT_FOUND",
        errorMessage: "Educateur n'existe pas",
      },
    });

    expect(result.status).toBe("not_found");
    expect(result.errorCode).toBe("NOT_FOUND");
    expect(result.qualifications).toHaveLength(0);
  });
});
