# AGENTS.md (Delegated)

This file is intentionally minimal.

Authoritative agent policy for this workspace:
- `../AGENTS.md`

Use the root policy for architecture, migration, skills, workflow, and validation rules.

Local workspace additions:
- Prefer the `jcodemunch` MCP server for repository exploration when it is available.
- Use `jcodemunch` for symbol search, file outlines, repo outlines, and targeted code retrieval before falling back to broad file reads.
- Fall back to `rg`, `sed`, and direct file reads when `jcodemunch` is unavailable or when raw file context is clearly more appropriate.
