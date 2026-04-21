---
name: audit-agent-template
description: Security audit agent template with skill injection and documentation
---

# AUDIT AGENT TEMPLATE

Use this template to create security audit agents with proper skill injection.

## REQUIRED SKILLS

```yaml
skills:
  - name: convex-best-practices
    path: /home/derpcat/projects/queue/.agents/skills/convex-best-practices/SKILL.md
  - name: convex-security-audit
    path: /home/derpcat/projects/queue/.agents/skills/convex-security-audit/SKILL.md
```

## REQUIRED DOCUMENTATION

### Auth Audits
- https://docs.convex.dev/auth/functions-auth
- https://docs.convex.dev/auth/custom-authentication

### Rate Limiting
- https://docs.convex.dev/production

### Error Handling
- https://docs.convex.dev/functions/error-handling

### Write Conflicts / OCC
- https://docs.convex.dev/error#1

### Data Model
- https://docs.convex.dev/understanding/concepts

## AUDIT WORKFLOW

```
1. Read SKILL.md files
2. Fetch documentation URLs
3. Explore target files
4. Run security checks
5. Document vulnerabilities
6. Provide fixes
```

## OUTPUT FORMAT

```markdown
## VULNERABILITIES

### [ID-001]
- **FILE:** path/to/file.ts
- **LINE:** 42-65
- **SEVERITY:** CRITICAL | HIGH | MEDIUM | LOW
- **CWE:** CWE-xxx
- **ISSUE:** One-line description

**Description:** Detailed explanation

**POC:** Proof of concept attack

**Fix:** Code fix with before/after

---

## HOLES (Missing Controls)

### [HOLE-001]
- **SEVERITY:** ...
- **CONTROL:** What's missing
- **IMPACT:** What could happen
- **RECOMMENDATION:** How to fix

---

## SUMMARY

| Category | Count |
|----------|-------|
| CRITICAL | X |
| HIGH | X |
| MEDIUM | X |
| LOW | X |
| Holes | X |
```