# AGENTS.md (Delegated)

This file is intentionally minimal.

Authoritative agent policy for this workspace:
- `../AGENTS.md`

Use the root policy for architecture, migration, skills, workflow, and validation rules.

Local workspace additions:
- Prefer the `jcodemunch` MCP server for repository exploration when it is available.
- Use `jcodemunch` for symbol search, file outlines, repo outlines, and targeted code retrieval before falling back to broad file reads.
- Fall back to `rg`, `sed`, and direct file reads when `jcodemunch` is unavailable or when raw file context is clearly more appropriate.

## CRITICAL: Git Checkout Protection Rule

**ABSOLUTE RULE: NEVER use `git checkout HEAD --`, `git restore HEAD --`, or any command that replaces local uncommitted files with HEAD versions without EXPLICIT user permission.**

If you need to see what changed in a file, use `git diff HEAD -- <file>` or `git show HEAD:<file>` — do NOT overwrite local files.

If a `git checkout` or `git restore` is attempted and it would destroy uncommitted changes, STOP and ask the user explicitly: "This will overwrite X uncommitted files. Do you want to proceed?"

In emergencies where git state is severely broken, explore alternatives first:
1. `git stash` — stash uncommitted changes
2. Check `git reflog` for previous HEAD positions
3. Check `git fsck --unreachable` for dangling blobs
4. Check for backup branches or remote branches
5. Check for compiled APKs (in `android/app/build/outputs/apk/`) which may contain JS bundles with embedded source maps
6. Source maps from APK builds (in `android/app/build/intermediates/sourcemaps/`) may contain full original source code

Recovery command for destroyed files (if APK source maps exist):
```python
# Extract source map from APK
python3 -c "
import json, zipfile, sys
with zipfile.ZipFile('app-debug.apk') as z:
    # Find source map
    for name in z.namelist():
        if 'packager.map' in name:
            sm = json.loads(z.read(name))
            sources = sm['sources']
            content = sm['sourcesContent']
            # Find and write files
            for i, s in enumerate(sources):
                if '/src/' in s and i < len(content):
                    path = s.replace('/src/', 'src/')
                    with open(path, 'w') as f:
                        f.write(content[i])
"
```

# context-mode — MANDATORY routing rules

You have context-mode MCP tools available. These rules are NOT optional — they protect your context window from flooding. A single unrouted command can dump 56 KB into context and waste the entire session.

## BLOCKED commands — do NOT attempt these

### curl / wget — BLOCKED
Any shell command containing `curl` or `wget` will be intercepted and blocked by the context-mode plugin. Do NOT retry.
Instead use:
- `context-mode_ctx_fetch_and_index(url, source)` to fetch and index web pages
- `context-mode_ctx_execute(language: "javascript", code: "const r = await fetch(...)")` to run HTTP calls in sandbox

### Inline HTTP — BLOCKED
Any shell command containing `fetch('http`, `requests.get(`, `requests.post(`, `http.get(`, or `http.request(` will be intercepted and blocked. Do NOT retry with shell.
Instead use:
- `context-mode_ctx_execute(language, code)` to run HTTP calls in sandbox — only stdout enters context

### Direct web fetching — BLOCKED
Do NOT use any direct URL fetching tool. Use the sandbox equivalent.
Instead use:
- `context-mode_ctx_fetch_and_index(url, source)` then `context-mode_ctx_search(queries)` to query the indexed content

## REDIRECTED tools — use sandbox equivalents

### Shell (>20 lines output)
Shell is ONLY for: `git`, `mkdir`, `rm`, `mv`, `cd`, `ls`, `npm install`, `pip install`, and other short-output commands.
For everything else, use:
- `context-mode_ctx_batch_execute(commands, queries)` — run multiple commands + search in ONE call
- `context-mode_ctx_execute(language: "shell", code: "...")` — run in sandbox, only stdout enters context

### File reading (for analysis)
If you are reading a file to **edit** it → reading is correct (edit needs content in context).
If you are reading to **analyze, explore, or summarize** → use `context-mode_ctx_execute_file(path, language, code)` instead. Only your printed summary enters context.

### grep / search (large results)
Search results can flood context. Use `context-mode_ctx_execute(language: "shell", code: "grep ...")` to run searches in sandbox. Only your printed summary enters context.

## Tool selection hierarchy

1. **GATHER**: `context-mode_ctx_batch_execute(commands, queries)` — Primary tool. Runs all commands, auto-indexes output, returns search results. ONE call replaces 30+ individual calls.
2. **FOLLOW-UP**: `context-mode_ctx_search(queries: ["q1", "q2", ...])` — Query indexed content. Pass ALL questions as array in ONE call.
3. **PROCESSING**: `context-mode_ctx_execute(language, code)` | `context-mode_ctx_execute_file(path, language, code)` — Sandbox execution. Only stdout enters context.
4. **WEB**: `context-mode_ctx_fetch_and_index(url, source)` then `context-mode_ctx_search(queries)` — Fetch, chunk, index, query. Raw HTML never enters context.
5. **INDEX**: `context-mode_ctx_index(content, source)` — Store content in FTS5 knowledge base for later search.

## Output constraints

- Keep responses under 500 words.
- Write artifacts (code, configs, PRDs) to FILES — never return them as inline text. Return only: file path + 1-line description.
- When indexing content, use descriptive source labels so others can `search(source: "label")` later.

## ctx commands

| Command | Action |
|---------|--------|
| `ctx stats` | Call the `stats` MCP tool and display the full output verbatim |
| `ctx doctor` | Call the `doctor` MCP tool, run the returned shell command, display as checklist |
| `ctx upgrade` | Call the `upgrade` MCP tool, run the returned shell command, display as checklist |
