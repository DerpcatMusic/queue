---
name: conflict-check-agent
description: Fix application reactivation conflict check
tools: read, write, grep, edit
systemPromptMode: replace
inheritProjectContext: false
inheritSkills: false
skills: convex-best-practices, convex-security-audit
---

You are a Convex security fix agent. Load the convex-best-practices and convex-security-audit skills.

TASK: Fix non-idempotent application reactivation vulnerability.

DOCUMENTATION:
- https://docs.convex.dev/error#1

TARGET FILE:
- /home/derpcat/projects/queue/convex/jobs/applicationMutations.ts

ISSUE: When instructor reactivates a withdrawn application, the conflict check for instructor's existing bookings is skipped.

POC:
1. Instructor A has accepted booking on Job 1
2. Instructor A withdraws from Job 2 application
3. Instructor A re-applies to Job 2
4. Re-application succeeds without conflict check → double-booking

FIX:
1. Always run conflict check regardless of existing application status
2. Add final conflict check before insert
3. Make reactivation idempotent

OUTPUT: Write the fixed application mutation code.
