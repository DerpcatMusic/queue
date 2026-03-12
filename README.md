# Queue (Expo)

Expo app for the QuickFit migration target.

## License

This repository is source-available under `PolyForm Noncommercial 1.0.0`.
You may not use copied source from this repository for commercial or monetized use.
See [LICENSE](./LICENSE).

## Setup

```bash
bun install
```

## Run

- Full dev stack with Bun:
  - `bun run dev`
- Start Expo:
  - `bun run start`
- Start Convex with on-the-fly `_generated` updates:
  - `bun run convex:dev`
- Android (native Windows emulator flow):
  - `bun run android`
- Android doctor:
  - `bun run android:doctor`
- Web:
  - `bun run web`
- Lint:
  - `bun run lint`

## Notes

- Android workflow is Windows-first (no WSL requirement).
- Convex updates `convex/_generated` automatically while `bun run convex:dev` is running. Keep `_generated` committed; `bunx convex codegen` is only for explicit regeneration and CI validation.
- See `docs/android-windows-setup.md` for details.
