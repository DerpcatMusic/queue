# Agent Initialization (Project)

Skills installed locally in `.agents/skills` include Expo and Convex skill packs.

Recommended usage by workstream:
- UI/navigation work: `building-native-ui`, `expo-dev-client`
- Networking and data: `native-data-fetching`, `expo-api-routes`
- Convex backend: `convex`, `convex-functions`, `convex-realtime`, `convex-schema-validator`
- Hardening: `convex-security-check`, `convex-best-practices`

Suggested parallel agent lanes:
1. `Frontend Agent`: onboarding and role-based routing.
2. `Backend Agent`: Convex schema, functions, race-safe claim logic.
3. `Infra Agent`: notifications, job expiry worker, env and deployment pipeline.

Operating rule:
- Keep backend invariants in Convex mutations (never only in client checks).
