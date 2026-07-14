# Contributing to Aegis

Aegis uses an **RFC (Request for Comments) process** for all language
changes. This is the concrete version of the "Open Governance Model"
described in the design document.

## The RFC Process

### 1. Before writing an RFC

Open a **discussion issue** first (label: `discussion`) describing the
problem you want to solve in 2-3 sentences. Wait for maintainer feedback
before investing time in a full RFC. This avoids wasted effort on changes
that won't be accepted.

### 2. Writing the RFC

Copy `rfc/0000-template.md` (create it if it doesn't exist yet) into
`rfc/0000-my-feature.md` (use the next available number). Fill in:

- **Summary** — one paragraph.
- **Motivation** — what problem does this solve?
- **Threat-table check** — does this weaken any existing security
  guarantee? If yes, the RFC will be rejected. If you're not sure, say so.
- **Detailed design** — syntax, semantics, examples.
- **Alternatives considered** — what else did you consider and why did you
  reject it?
- **Backward compatibility** — does this break existing programs? If yes,
  see the versioning policy below.

### 3. Review

Open a PR with the RFC file. Discussion happens in the PR. The RFC is
accepted when a maintainer approves it and there has been at least 7 days
of public comment.

### 4. Implementation

Once accepted, the RFC is assigned a tracking issue. Implementation can
proceed. The implementation PR must include tests (see `/tests`).

## What requires an RFC

- Any change to the language **syntax** (new keywords, operators, grammar).
- Any change to the **type system** or **capability model**.
- Any change to the **memory model** or **concurrency model**.
- Any change that **weakens** a security guarantee (this will be rejected).
- Any **breaking change** to the standard library.

## What does NOT require an RFC

- Bug fixes (just open a PR with a test).
- New examples in the playground.
- Documentation improvements.
- Performance improvements that don't change semantics.
- New methods on existing types (if they don't affect security).

## Merge rights (current: project founder)

| Phase | Merge rights | Notes |
|---|---|---|
| Current (MVP) | Project founder only | Fast decisions, single maintainer |
| After 3+ active contributors | Founder + 2 contributors | PRs need 1 approval from a non-author |
| After 10+ active contributors | 5-person core team | RFCs need 3 core-team approvals; core team elected annually |

This is intentionally simple now and will formalize as the project grows.
The goal is to never let governance block a good contribution, but also
never let a single person break a security guarantee without review.

## Test requirements

Every PR that changes the interpreter MUST:

1. Not break any existing test (`bun test` must pass).
2. Include new tests for any new behavior.
3. If the change touches security, include a test that verifies the
   guarantee still holds (see `tests/security.test.ts` for the pattern).

CI runs automatically on every PR. A failing CI blocks merge.

## Code style

- TypeScript throughout.
- `bun run lint` must pass (ESLint with Next.js config).
- No `any` types in the interpreter unless documented why.
- Every security check must have a comment explaining which vulnerability
  class it prevents.
