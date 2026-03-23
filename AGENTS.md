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

---

## Payments Tab Analysis (2026-03-23)

### Current State
The instructor payments tab (`src/app/(app)/(instructor-tabs)/instructor/profile/payments.tsx`) suffers from **severe cognitive overload**. It violates multiple design principles by presenting too much information, too many states, and too many actions simultaneously.

### Cognitive Overload Issues

#### 1. **Status Pill Overload** (lines 562–647)
- Complex nested ternary logic determining color/state
- 3 different status messages with 3 different colors
- 3 separate hint/error messages conditionally shown below
- Mixes identity verification + bank connection + onboarding status in one pill

**Issue**: User must decode 3-state logic before understanding their status.

#### 2. **Hero Balance Card** (lines 649–830)
- Large balance + currency badge + 2 CTAs
- 4+ disabled states with opacity-only feedback (not accessible)
- Error/info messages inline below the card
- Confusing: "Withdraw" button behavior depends on 4 conditions

**Issue**: Hero should be ONE thing—balance or action. Not 4 things at once.

#### 3. **Payout Preference Section** (lines 832–999)
- Segmented toggle with 3 options
- Inline date picker that expands and adds 4+ more controls
- Cancel/Save buttons appear only when date picker is open
- 3 different hint texts based on selected mode
- Error/info feedback below

**Issue**: Secondary preference settings should be collapsed or moved to a separate screen.

#### 4. **Stats Row** (lines 1001–1049)
- Two inline metrics (pending/paid) with colored dots
- Dot colors (warning/success) may conflict with status pill meanings
- Appears between preference section and transaction list

**Issue**: Breaks visual flow. Metrics belong inside the hero card or grouped with balance.

#### 5. **Inline Receipt Expansion** (lines 1051–1209)
- Clicking a payment row expands detailed receipt inline
- Has its own loading, not-found, and content states
- 12+ data fields in receipt

**Issue**: Receipt details belong in a bottom sheet or modal, not inline.

#### 6. **Payment Activity List**
- Shows up to 40 transactions
- Each row displays: status dot, sport, date, payout status, amount
- "X items" count shown in header

**Issue**: List is good, but mixing receipt expansion with it is confusing.

### Design Principles Violated

| Principle | Violation |
|-----------|-----------|
| Single primary action | Hero has 2 CTAs (withdraw + connect bank) |
| Utility-first | Decorative/hint text for every state |
| Low-noise backgrounds | Status pill, balance card, preference, stats, receipt, list = 6 sections |
| One primary action per viewport | 3 different sections claim attention |

### Streamlining Recommendations

#### Phase 1: Quick Wins
1. **Merge Stats into Hero Card** — Pending/paid amounts should be inside the balance card as secondary labels, not a separate row
2. **Simplify Status Pill** — Use a singleKitChip with icon instead of complex nested ternaries
3. **Collapse Preference Section** — Use a disclosure pattern (KitDisclosureButtonGroup) instead of inline expansion

#### Phase 2: Restructure
4. **Move Receipt to Sheet** — Use `BottomSheet` modal instead of inline expansion
5. **Separate Bank Connection** — Connect bank should be a separate screen or prominent modal, not buried in hero
6. **Consolidate Error States** — Use a single error banner component at top instead of scattered error/info text

#### Phase 3: Information Architecture
7. **Progressive Disclosure** — Show balance + primary CTA first, hide preferences behind "..." menu or separate tab
8. **Reduce List Density** — Show 10 items with "See all" instead of 40 items
9. **One Status Language** — Pick one color/semantic system for status (current: payment status colors + payout status colors + general status colors = 3 systems)

### Reference: Cleaner Profile Tab Pattern
See `sports.tsx` for cleaner structure:
- Single hero card with state signals
- One primary action rail at bottom
- Collapsible sections with ProfileSectionCard
- Error states in dedicated card

---

## Hardcoded Design Values Audit (2026-03-23)

### Priority Targets (Most Violations)

| File | Issue Count | Category |
|------|-------------|----------|
| `payments.tsx` (instructor) | **60+** | Colors, spacing, typography, radius |
| `identity-verification.tsx` | **40+** | Magic numbers, colors, spacing |
| `onboarding.tsx` | **30+** | Animation timings, spacing |
| `studio/profile/index.tsx` | **20+** | Desktop layout dimensions |
| `kit-button-group.tsx` | **24** | Radius, spacing, colors |
| `kit-disclosure-button-group.tsx` | **21** | Radius, spacing, colors |
| `kit-text-field.tsx` | **13** | Spacing, typography |
| `kit-success-burst.tsx` | **11** | Bubble positions, dimensions |

### Most Common Violations

1. **Colors**: `rgba(...)` hardcoded instead of `palette.xxx` with opacity
2. **Spacing**: Magic numbers `4, 6, 8, 10, 12, 14, 16, 20, 24` instead of `BrandSpacing.xs/sm/md/lg/xl/xxl`
3. **Typography**: `fontSize: 15` instead of `BrandType.body` (16) or `BrandType.bodyMedium`
4. **Radius**: `BrandRadius.button - X` instead of `BrandRadius.buttonSubtle`
5. **Magic numbers**: Dimension values (40, 44, 48, 50, 54, 56, 72, 78) without tokens

### Files CLEAN (No Hardcoded Values)

**Kit components**: `kit-switch.tsx`, `kit-list.tsx`
**App routes**: `sports.tsx`, `instructor/profile/index.tsx`, `studio/index.tsx`, `sign-up.tsx`, `sign-in.tsx`
**Components**: `profile-settings-sections.tsx`, `status-signal.tsx`, `profile-role-switcher-card.tsx`, `identity-status-ui.tsx`, `sports-multi-select.tsx`
**Hooks/Lib**: Most files clean — only 5 issues total across all utility files

### Files with Notable Issues

| File | Key Issues |
|------|------------|
| `device-calendar-sync.ts` | Hardcoded `#2A6CF0` color |
| `home-header-sheet.tsx` | Avatar size `68`, badge size `22` |
| `action-button.tsx` | minHeight `54, 42`, minWidth `96` |
| `address-autocomplete.tsx` | radius `12`, minHeight `46` |
| `instructor-job-card.tsx` | width `44%`, complex radius calculations |
| `loading-screen.tsx` | Multiple rgba colors, dimensions `236x236` |
| `queue-map.web.tsx` | radius `28`, typography `38/36/-1` |
| `map-web-command-panel.tsx` | width `360`, radius `34` |
| `studio-jobs-list-parts.tsx` | Gap/spacing values, avatar `42x42` |

### Design Tokens Missing (Need Addition to brand.ts)

- `BrandSpacing.iconContainerLarge` (78px for Didit verification avatar)
- `BrandSpacing.buttonMinHeight` (44, 48, 50, 54 — various button heights)
- `BrandSpacing.haloSize` (180px for identity verification)
- `BrandSpacing.mapMinHeight` (300px for onboarding map)
- `BrandSpacing.multilineInputMinHeight` (96px)
- `BrandSpacing.dividerHeight` (1px — or use border width)
- `BrandSpacing.textShadowOffset`, `textShadowRadius` (for instructor job cards)
- `BrandRadius.circle` (should be `999` or explicit `999` documented as "full circle")
- `BrandType.display.fontSize` (42), `BrandType.hero.fontSize` (38) already exist but not used

### Recommended Fixes

1. **Phase 1 (Quick Wins)**: Fix `rgba(...)` colors — these bypass the entire palette system
2. **Phase 2 (Systematic)**: Replace spacing numbers with `BrandSpacing` tokens
3. **Phase 3 (Thorough)**: Fix typography and radius violations
4. **Consider**: ESLint rule `react-native/no-inline-styles` to catch violations automatically

---

## Design Context

### Users
- **Instructors**: Individual driving teachers managing schedules, zones, and earnings
- **Studios**: Driving schools managing multiple instructors
- **Students**: Mixed demographics seeking driving instruction (teens to adults) — may be stressed, need a trusted guide

### Brand Personality
- **Voice**: Calm, Clear, Supportive
- Purple conveys expertise and trust without feeling cold or corporate
- Tone is reassuring and helpful — never pushy or overwhelming

### Aesthetic Direction
- **References**: Uber/Wolt-inspired — fast scan hierarchy, strong contrast, large touch targets
- **Light mode**: Purple `#8B5CF6` on light backgrounds `#F6F4FB`
- **Dark mode**: Lighter purple `#8F6AFB` on dark backgrounds `#0B0910`
- **What to AVOID**: Overly playful/cartoonish aesthetics, cluttered interfaces, generic corporate feel

### Design Principles
1. **Calm clarity**: Every screen scannable within 2 seconds
2. **Utility-first**: Every element must serve a clear purpose
3. **Single primary action**: One dominant CTA per screen
4. **Consistent spacing**: Follow the scale (`xs:4, sm:8, md:12, lg:16, xl:24, xxl:32`)
5. **Semantic over hardcoded**: Use `palette.xxx` from `useBrand()` — never hardcoded colors
6. **Native feel**: Preserve haptics, ripple, safe areas
7. **Accessible contrast**: WCAG AA minimum

### Tech Stack
- Expo, React Native, Convex (backend), expo-router, NativeWind
- Custom UI Kit at `@/components/ui/kit` (KitChip, KitSurface, KitTextField, KitList, etc.)
- Custom TopSheet component for expandable sheets
- Tab-based navigation with role-specific routes

### Known UX Debt
- Instructor payments tab — cognitive overload (see Payments Tab Analysis above)
- Hardcoded design values throughout codebase (see Hardcoded Design Values Audit above)
