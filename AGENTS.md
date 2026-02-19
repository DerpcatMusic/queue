# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Expo Router screens and route layouts (`_layout.tsx`, route files like `modal.tsx`).
- `components/`: Reusable UI building blocks.
- `hooks/`: Shared React hooks.
- `constants/`: App-level constants (theme tokens, etc.).
- `assets/`: Static assets (images, icons, fonts).
- `convex/`: Convex backend/functions and related config.
- `scripts/`: Utility scripts, including WSL Android helpers in `scripts/android/`.
- `docs/`: Project docs, including Android-on-WSL setup.

## Build, Test, and Development Commands
- `bun install`: Install dependencies.
- `bun run start`: Start Expo dev server.
- `bun run web`: Run web target.
- `bun run android`: Start Expo and target Android (standard flow).
- `bun run android:wsl`: WSL-specific Android flow (launches Windows emulator + Expo).
- `bun run android:wsl:doctor`: Validate Java/ADB/AVD setup for WSL workflow.
- `bun run lint`: Run Expo/ESLint checks.

## Coding Style & Naming Conventions
- Language: TypeScript (`.ts`/`.tsx`) with React Native + Expo Router patterns.
- Indentation: 2 spaces; keep imports grouped and sorted logically.
- Components: `PascalCase` filenames for reusable components (for example `ThemedText.tsx`).
- Hooks: `use-*` naming pattern (for example `use-theme-color.ts`).
- Routes: follow Expo Router file-based naming inside `app/`.
- Linting: use `eslint` via `bun run lint`; fix warnings before PR.

## Testing Guidelines
- No dedicated test framework is currently configured.
- Minimum quality gate: lint clean and manual validation on at least one target (`web` or Android emulator).
- If adding tests, place them near source as `*.test.ts(x)` and include run instructions in PR.

## Commit & Pull Request Guidelines
- Local Git history is not available in this workspace snapshot; use Conventional Commit style moving forward.
- Recommended commit format: `feat: ...`, `fix: ...`, `chore: ...`, `docs: ...`.
- PRs should include:
  - clear summary and scope,
  - linked issue/task,
  - validation steps run (commands + platform),
  - screenshots/video for UI changes.

## Security & Configuration Tips
- Keep secrets in `.env.local`; never commit API keys or tokens.
- For Android on WSL, prefer `bun run android:wsl` and run `bun run android:wsl:doctor` before debugging connectivity.

## Agent Rules (Mandatory)
- Stack baseline:
  - Expo SDK 54 (`expo` `~54.x`).
  - Convex backend with latest stable `convex` package in `package.json`.
  - Clerk authentication via `@clerk/clerk-expo`.
- Auth architecture:
  - Treat Clerk + Convex as the only supported auth path unless explicitly changed by the user.
  - Preserve compatibility with `ConvexProviderWithClerk` in `app/_layout.tsx`.
- Documentation freshness:
  - When implementing or changing behavior for any library/framework API, fetch current official docs first and do not rely on model memory alone.
  - Use Context7 MCP as the first source for library/framework docs whenever available.
  - Only fall back to direct web browsing when Context7 does not have the needed documentation or content is insufficient.
  - Prefer primary sources in this order: official docs site, package docs/changelog, framework reference.
  - If docs cannot be reached, state that clearly before proceeding with a best-effort fallback.
