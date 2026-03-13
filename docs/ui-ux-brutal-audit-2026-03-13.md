# Queue UI/UX Brutal Audit

Date: 2026-03-13

Scope: repo-wide code audit of the Expo app shell, theme system, auth, onboarding, home, jobs, calendar, map, and profile.

Method: this is a code-grounded audit, not a screenshot/device review. The judgments below come from implemented route structure, state shape, copy, component anatomy, tokens, and native-vs-custom decisions in the current codebase.

## Executive Verdict

Queue is not under-designed. It is over-authored.

The app wants to feel fast, bold, in your face, and welcoming. Right now it more often feels:

- curated instead of immediate
- dashboarded instead of actionable
- soft instead of sharp
- custom instead of truly native
- duplicated instead of decisive

The central problem is simple:

`the app keeps showing product ceremony before product momentum`

That is why it feels slower than it probably is.

## Scorecard

- Speed feeling: `4/10`
- Boldness: `5/10`
- Native fit: `5/10`
- UX clarity: `4/10`
- Boilerplate discipline: `3/10`

## The Product You Actually Want

For this category, "fast, bold, welcoming" should mean:

- one obvious next action on every major screen
- lists before dashboards
- native headers and navigation doing more of the work
- high contrast where action matters, quieter neutrals elsewhere
- fewer surfaces, fewer wrappers, fewer repeated summaries
- motion as feedback and transition, not identity theater

Queue is not there yet because too much effort is going into shell, summary, and abstraction.

## Highest-Severity Findings

### 1. The theme system is semantically broken

Files:

- `src/hooks/use-theme-preference.tsx`
- `src/constants/brand.ts`
- `src/components/ui/kit/use-kit-theme.ts`

What is wrong:

- `stylePreference` says the app can operate in different visual modes, but the implementation keeps forcing `"native"`.
- `getBrandPalette()` ignores `stylePreference`.
- `useKitTheme()` exposes the distinction while hard-coding `isCustomStyle = false`.

Why this is bad:

- every UI decision downstream is standing on a fake abstraction
- you are paying the code cost of a dual-style system without getting the design clarity of either
- it encourages wrapper logic and "maybe native, maybe custom" compromises all over the app

Hard directive:

- choose one honest direction
- either go truly native-first or truly custom-branded
- stop carrying a fake split-brain theme architecture

### 2. The brand palette is too soft for the brief

Files:

- `src/constants/brand.ts:231`
- `src/constants/brand.ts:252`

What is wrong:

- olive, cream, beige, and muted slate are coherent
- they are not urgent
- they do not communicate pace, competition, or live sports energy

Why this is bad:

- typography says sports
- color says boutique lifestyle admin app
- the system is working against your stated product feeling

Hard directive:

- keep the typography edge
- replace the polite palette
- action color must hit harder
- large surfaces should stop being so tinted and precious

### 3. The shell is carrying too much chrome

Files:

- `src/modules/navigation/role-tabs-layout.web.tsx`
- `src/components/layout/screen-scaffold.tsx`
- `src/components/layout/tab-screen-root.tsx`
- `src/components/layout/tab-screen-scroll-view.tsx`
- `src/components/layout/top-sheet-surface.tsx`

What is wrong:

- web has a branded rail, alert card, workspace framing, descriptive tab copy, and meta-dashboard furniture
- native screens negotiate through multiple wrappers for header, inset, scroll, desktop frame, and top-sheet behavior

Why this is bad:

- navigation is supposed to get out of the way
- your shell keeps narrating itself
- every route inherits complexity before it has earned it

Hard directive:

- tabs navigate
- headers orient
- content does the rest
- cut every shell element that is not required for navigation, safe area, or one screen-level action

### 4. Home and jobs are built around status theater instead of next actions

Files:

- `src/components/home/instructor-home-content.tsx`
- `src/components/home/studio-home-content.tsx`
- `src/components/home/performance-hero-card.tsx`
- `src/components/jobs/instructor-feed.tsx`
- `src/components/jobs/studio-feed.tsx`

What is wrong:

- header sheet
- hero block
- stats row
- chart
- banners
- metric tiles
- filters

Then eventually the actual list.

Why this is bad:

- sports/ops users need "what needs me now?"
- the app often answers four questions before that one
- charts and counters are getting prime space that should belong to queues and upcoming work

Hard directive:

- home gets one lead rail and one support section
- jobs becomes a list-first board
- repeated counts get one home only
- charts leave the first screenful

### 5. Onboarding is a giant configuration transaction

Files:

- `src/app/onboarding.tsx`

What is wrong:

- role selection
- profile setup
- sports
- zones
- geocoding
- GPS
- map interaction
- push permissions
- studio/instructor branching
- identity follow-up

All coordinated in one route and one state machine.

Why this is bad:

- first-run should feel inevitable
- this feels like a setup wizard for your data model
- the code complexity leaks directly into the UX

Hard directive:

- role
- essentials
- go live

Everything else gets deferred or split into later flows.

## Surface Teardown

### Auth

Files:

- `src/app/(auth)/sign-in-screen.tsx`
- `src/app/(auth)/_layout.tsx`

What is broken:

- Google, Apple, OTP, and magic link all compete at equal weight
- there is no obvious default door
- the page has almost no emotional product framing
- the stack header exists but is not doing meaningful native orientation work

What to do:

- pick one primary sign-in method
- demote the others behind secondary affordances
- add one hard, product-specific promise above the fold
- either embrace the native header or replace it with a stronger, singular branded entry composition

### Onboarding

Files:

- `src/app/onboarding.tsx`
- `src/i18n/translations/en.ts`

What is broken:

- the copy promises "a few quick steps" while the actual flow is heavy
- instructor onboarding mixes text fields, chips, address search, manual resolve, selected zone chips, push opt-in, and live map interaction in one control panel
- labels and captions are often duplicated, which makes the screen look generated rather than intentional

What to do:

- stop lying about speed in the copy
- one step, one mental model
- remove duplicated micro-headings
- move push permission after the user gets value
- move identity verification into a sharper post-onboarding unlock flow

### Home

Files:

- `src/components/home/home-screen.tsx`
- `src/components/home/instructor-home-content.tsx`
- `src/components/home/studio-home-content.tsx`
- `src/components/home/home-header-sheet.tsx`

What is broken:

- both roles use broadly similar anatomy even though their mental models should differ
- the top-sheet header is visually clever but overperforms the job of a header
- the screens lead with status and summary instead of action

What to do:

- instructor home should feel opportunistic and personal
- studio home should feel queue-driven and operational
- remove mirrored hero/stats/chart composition between roles
- keep one summary sentence, then show the work

### Jobs

Files:

- `src/components/jobs/instructor-feed.tsx`
- `src/components/jobs/studio-feed.tsx`
- `src/components/jobs/studio/create-job-sheet.tsx`

What is broken:

- jobs is still treated like a dashboard about jobs, not a board you can work from
- studio create-job is strong in intent but still wrapped in too much branded sheet choreography

What to do:

- list first
- search and filter pinned at top
- one compact summary line max
- studio defaults to review queue when there are pending applicants
- create job flow should feel like a fast native post sheet, not a mini command center

### Calendar

Files:

- `src/components/calendar/calendar-tab-screen.tsx`
- `src/components/calendar/use-calendar-tab-controller.ts`
- `src/app/(app)/(instructor-tabs)/instructor/calendar/index.tsx`

What is broken:

- the date navigator depends on a private gesture language
- the screen manufactures emptiness by rendering lots of empty-day content
- route behavior can read as lag on first focus
- desktop web promises a screen that degrades into a placeholder

What to do:

- remove gesture cleverness
- use a simpler native date model
- stop rendering empty days as full content rows
- either support calendar on a platform or stop pretending it exists there

### Map

Files:

- `src/components/map-tab/map-tab-screen.tsx`
- `src/components/maps/queue-map.native.tsx`
- `src/components/maps/queue-map.web.tsx`

What is broken:

- the map editor stacks too many simultaneous layers
- native loading/error states block the whole experience
- Expo Go fallback is a hard dead end
- web map uses fake poster geometry instead of a trustworthy map mental model

What to do:

- one persistent bottom control surface
- one error channel only
- preserve place during loading/failure
- stop making web feel like a different product

### Profile

Files:

- `src/app/(app)/(instructor-tabs)/instructor/profile/index.tsx`
- `src/app/(app)/(studio-tabs)/studio/profile/index.tsx`
- `src/components/profile/profile-editor-form.tsx`
- `src/components/profile/profile-settings-sections.tsx`
- `src/app/(app)/(instructor-tabs)/instructor/profile/location.tsx`
- `src/app/(app)/(instructor-tabs)/instructor/profile/payments.tsx`
- `src/app/(app)/(studio-tabs)/studio/profile/payments.tsx`

What is broken:

- profile is simultaneously a completion funnel, settings hub, account page, and operations console
- setup reminders repeat in multiple wrappers
- edit is long-form CRUD, not a focused identity builder
- location feels form-like instead of spatial and confirmatory
- payments mixes product UI with back-office plumbing

What to do:

- one "Complete profile" rail
- one "Manage account" section
- deeper routes for the rest
- profile edit split into identity, public profile, sports, contact
- payments split into "Get paid" and "History"

## Design-System Critique

### The kit is too large for the payoff

Files:

- `src/components/ui/kit/kit-button.tsx`
- `src/components/ui/kit/kit-text-field.tsx`
- `src/components/ui/kit/kit-surface.tsx`
- `src/components/ui/native-search-field.tsx`

What is wrong:

- too many wrappers around basic interactions
- custom text field and search are not distinctive enough to justify maintenance cost
- surface components are doing branding work that should usually come from layout, not from yet another container

Keep:

- `KitButton`
- `KitSurface`
- `KitStatusBadge`
- maybe one search primitive

Compress:

- field variants
- surface variants
- pressable abstractions
- top-sheet motifs

Kill:

- fake dual-style theme behavior
- custom search where header/native search works
- extra branded grouping containers that only add padding and radius

## Keep / Compress / Kill

### Keep

- `NativeTabs`
- strong typography direction
- haptics and safe-area discipline
- role split as a product concept
- map as a differentiating surface

### Compress

- home summaries
- jobs summaries
- profile readiness system
- onboarding steps
- chart interactions
- web shell

### Kill

- theme ambiguity
- repeated stat homes
- over-captioned sections
- decorative shell cards
- always-on header choreography
- platform placeholders that still occupy IA

## Native-First Rules

- most routes should be native stack title + one scroll container + content
- lists are the product
- page titles belong in headers, not in extra dashboard cards
- use header search where possible
- use modal/sheet routes more, custom mega-surfaces less
- trust native inputs more
- reserve strong motion for transitions, feedback, and changes of state

## Copy Rules

Current tone often sounds administrative:

- ready
- pending
- setup
- profile complete
- status

That is accurate but dead.

Replace with consequence and momentum:

- `Verify identity` -> `Unlock booking`
- `Pending setup items` -> `2 blockers before you go live`
- `Profile set` -> `Ready for offers`
- `Need review` stays good because it implies action now

## 14-Day Ship Order

### Days 1-2

- remove the fake dual-style theme split
- choose the real visual direction
- reduce web shell to navigation plus content

### Days 3-5

- cut home down to one lead action rail per role
- demote or remove charts from the first screenful
- remove duplicate stat homes

### Days 6-8

- rebuild jobs as list-first
- make studio default into review work
- simplify create-job to a faster sheet flow

### Days 9-11

- split onboarding into narrower steps
- remove push permission from first-run critical path
- collapse auth to one obvious primary door

### Days 12-14

- flatten profile into one completion rail plus one account area
- simplify map control layering
- replace calendar gesture cleverness with clearer date navigation

## Execution Log

### Slice 01

- removed the fake dual-style theme split
- deleted dead kit pieces that only existed to support that fiction
- reduced theme logic to one honest path

### Slice 02

- stripped home back toward action-first content
- removed chart-first and stat-heavy lead sections
- replaced feed actions that depended on `KitButton` and `KitPressable`

### Slice 03

- rebuilt jobs feeds into one native-first page shape per role
- deleted wide-web hero cards, metric rails, workflow panels, and duplicate mobile ops blocks
- kept the jobs surface focused on filters, queue state, and the actual list

### Slice 04

- removed `KitButton` from auth and onboarding
- made sign-in lead with email first instead of giving every auth method equal weight
- reduced onboarding action plumbing to simpler native-style buttons and clearer next/back flows

### Slice 05

- removed kit action wrappers from the create-job sheet and small shared controls
- simplified dismiss and clear interactions to plain native pressables
- trimmed over-authored create-job copy so the sheet gets to the point faster

### Slice 06

- removed kit action wrappers from the reusable profile surfaces
- simplified profile editor, readiness, and sports-selection controls without changing the route structure yet
- kept the profile cleanup focused on shared components so later route cuts can delete more safely

### Slice 07

- removed kit button usage from the remaining profile route forms for sports, location, and calendar settings
- kept those routes structurally intact while simplifying their action layer
- finished the profile-form cleanup before moving to heavier calendar, map, and payments screens

### Slice 08

- removed kit action wrappers from medium shared surfaces including address autocomplete, payment activity rows, web tabs, map controls, and the performance hero selector
- kept the slice tactical so the remaining work is concentrated in the largest screen files
- reduced more interaction plumbing without expanding the abstraction surface

### Slice 09

- removed kit action wrappers from the main calendar screens on native and web
- simplified week, date-picker, and agenda selection controls without changing calendar behavior
- kept the slice mechanical so remaining map-tab and payments cleanup can stay isolated

### Slice 10

- removed kit action wrappers from the main map tab screen across web and mobile
- simplified territory selection, list rows, and bottom-sheet controls to plain pressables and action buttons
- reduced map editing ceremony without changing zone selection or save flow

### Slice 11

- removed kit pressable usage from the instructor payments screen
- simplified payout, bank, schedule, and receipt actions to native pressables while keeping payout logic intact
- reduced one of the heaviest profile screens without changing payment state or hosted onboarding flow

### Slice 12

- removed the last app-level kit button and pressable usage outside the kit internals
- simplified studio payment detail dismissal and identity-verification primary actions to native pressables
- finished the wrapper removal sweep so remaining kit references are implementation details, not product-screen dependencies

### Slice 13

- deleted `KitButton` and `KitPressable` from the kit itself after product-screen usage hit zero
- rebuilt the remaining kit internals on top of native `Pressable` and direct haptic helpers instead of a wrapper abstraction
- updated kit documentation so the library description matches the reduced component surface

## Final Verdict

The app is not ugly.

The app is spending its design budget in the wrong places.

Right now Queue has:

- too much wrapper intelligence
- too much dashboard structure
- too much repeated explanation
- too much softness in the visual system

It needs:

- less ceremony
- less fake flexibility
- less shell
- less repetition
- more action density
- more contrast
- more native confidence

If you want the shortest version:

`Cut chrome. Cut duplication. Cut fake flexibility. Let queues, maps, and next actions become the product.`
