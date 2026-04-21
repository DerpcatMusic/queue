# France professional card verification

## What we verified

Queue can verify French sports instructors from a **public government registry**.

Two public surfaces were confirmed:

- Public profile page: `https://recherche-educateur.sports.gouv.fr/CartePro/{cardNumber}`
- Public JSON API behind the page: `https://eme-api-core.sports.gouv.fr/api/Educateur/GetPubliEdu?numCartePro={cardNumber}&identifiant=&isStagiaire=false`

The JSON endpoint was discovered by rendering the public page in headless Chrome and inspecting the network log.

## Live test result

A live probe against sample card `00410ED0012` returned:

- `prenom`: `Samuel`
- `nom`: `GILLET`
- `cartePro`: `00410ED0012`
- `expiration`: `17/06/2030`
- `delivreePar`: `SDJES ALPES de HAUTE PROVENCE`
- `hasValid`: `true`
- `affichePublic`: `true`
- `listQualifs[0].titre`: `BEES 1 - SKI ALPIN`
- `listQualifs[1].titre`: `BEES 1 - VOL LIBRE OPTION PARAPENTE`

An invalid sample `99999ED9999` returned:

- `errorCode`: `NOT_FOUND`
- `errorMessage`: `Educateur n'existe pas`
- `affichePublic`: `false`

## Repo implementation

### Shared library

- `convex/lib/professionalRegistryFrance.ts`
- `convex/lib/professionalRegistry.ts`

These files normalize the card number, call the public API, and map the government payload into a stable Queue shape.

### Convex action

- `convex/compliance/publicProfessionalRegistry.ts`

Entry point:

- `lookupPublicProfessionalRegistryRecord({ country: "FR", identifier })`

Current supported countries:

- `FR`

### Local probe script

- `scripts/france/probe-carte-pro.mjs`

Run:

```bash
node ./scripts/france/probe-carte-pro.mjs 00410ED0012
```

Or with the package script:

```bash
npm run france:probe -- 00410ED0012
```

## Suggested onboarding rule for France

For instructors teaching in France:

1. Ask for the **Carte Professionnelle** number.
2. Run the public registry lookup.
3. Compare returned name with the instructor's verified identity.
4. Require:
   - `status === "found"`
   - `isPublic === true`
   - `hasValidRegistration === true`
   - future `expiresOn`
5. Store the raw government fields you need for audit.
6. Separately verify apparatus / specialization where the card is too broad.

## Caveat

This endpoint appears public and usable today, but it is **not treated here as a formally documented public API contract**. If the ministry changes hosts, path names, or CORS behavior, Queue should fall back to the public profile page and manual review.
