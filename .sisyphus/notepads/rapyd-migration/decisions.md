# Rapyd Architecture Decisions

## Date: 2026-03-21

## Decision 1: Split-at-Checkout vs Payout Disbursement
**Context**: App needs to credit instructors for course sales
**Decision**: Use split-at-checkout (Phase 2) rather than maintaining current flow
**Rationale**: 
- Real-time instructor wallet crediting
- Reduced platform float
- Atomic split eliminates reconciliation risk
**Status**: Recommended for Phase 2

## Decision 2: Hosted Checkout vs Direct API
**Context**: PCI compliance consideration
**Decision**: Use hosted checkout (`POST /v1/checkout`) for all card collection
**Rationale**:
- PCI-DSS certification not required for hosted flow
- Simpler integration
- Card data never touches merchant servers
**Status**: Required for Phase 2

## Decision 3: Instructor Wallet Model
**Context**: Each instructor needs a Rapyd wallet
**Decision**: Provision individual `person` type wallet per instructor at onboarding
**Rationale**:
- Per-wallet tracking of earnings
- Enables future self-service payouts
- Rapyd supports parent-child wallet hierarchy if needed
**Status**: Required for Phase 2

## Decision 4: Israel A2A Deferral
**Context**: No confirmed bank pay-in for Israel in sandbox/docs
**Decision**: Defer A2A research until production dashboard access
**Rationale**:
- Cannot validate in sandbox
- Requires account-specific enablement
- Card pay-in is sufficient for Phase 2
**Status**: Deferred to production validation

## Decision 5: Sandbox Checkout Mode Default
**Context**: Flow A checkout failed in IL sandbox because bank pay-in rails are unavailable (only cards exist)
**Decision**: Make checkout mode default environment-sensitive: sandbox → flexible, production → a2a
**Rationale**:
- IL sandbox lacks A2A rails (confirmed by research)
- Card methods exist and work for sandbox testing
- Explicit `RAPYD_CHECKOUT_MODE` override is always respected
- Production behavior stays fail-closed for A2A unless explicitly configured
**Status**: Implemented 2026-03-21
