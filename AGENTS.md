# AGENTS.md (Delegated)

This file is intentionally minimal.

Authoritative agent policy for this workspace:
- `../AGENTS.md`

Use the root policy for architecture, migration, skills, workflow, and validation rules.

Local workspace additions:
- Prefer the `jcodemunch` MCP server for repository exploration when it is available.
- Use `jcodemunch` for symbol search, file outlines, repo outlines, and targeted code retrieval before falling back to broad file reads.
- Fall back to `rg`, `sed`, and direct file reads when `jcodemunch` is unavailable or when raw file context is clearly more appropriate.
- For UI architecture work, prefer deletion over adaptation when an abstraction is dormant, duplicated, or only partially wired.
- Maintain one primary styling path. Remove inactive Tailwind/NativeWind plumbing rather than preserving “optional” styling systems.
- Maintain one runtime theme source. Do not keep fake appearance modes or duplicate token layers alive for compatibility alone.
- Prefer a small primitive layer (`text`, `icon`, `pressable`, `surface`, `field`, `button`, `list-row`) and compose feature widgets from it.
- Reduce role-based duplication by extracting shared presenters and thin role-specific data containers when possible.
- Remove pass-through screen/layout wrappers unless they enforce a real invariant shared across routes.
