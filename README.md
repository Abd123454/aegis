# Aegis

![CI](https://github.com/Abd123454/aegis/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)
![Status](https://img.shields.io/badge/status-research%20prototype-orange.svg)

> A programming language built from scratch for security-by-construction,
> ease of learning, and universal reach. This repository contains the
> language design document (RFC) and a working reference interpreter for a
> meaningful subset.

**Project status: research prototype / MVP.** Not production-ready. Not
"unhackable." The interpreter is a teaching tool that demonstrates the
security properties; it is NOT a production compiler.

---

## What Aegis is

Aegis is a new programming language whose defining mission is to eliminate
entire classes of security vulnerabilities **by construction** — by making
the vulnerable pattern impossible to *express*, not just discouraged.

The reference interpreter in this repository (`src/lib/aegis/interpreter.ts`)
implements a meaningful subset of the language and enforces the following
security properties. Each is verified by an automated test in `/tests`:

| Vulnerability class | Mechanism | Test file |
|---|---|---|
| Buffer overflow | Array indexing returns `Option<T>`; OOB → `None` | `tests/security.test.ts` |
| Use-after-free / double-free | No `malloc`/`free`; ownership-based memory | `tests/security.test.ts` |
| Null dereference | No `null` literal; use `Option<T>` | `tests/security.test.ts` |
| SQL injection | `db.query(template, params)` only — single-string form rejected | `tests/security.test.ts` |
| Command injection | `shell.run([args])` only — string form rejected | `tests/security.test.ts` |
| Data race | `static mut` forbidden; `spawn(move, ...)` required | `tests/security.test.ts` |
| Ambient authority | No `fs`/`net`/`shell` globals; reachable only via `env: Cap` | `tests/security.test.ts` |
| Integer overflow | Checked arithmetic; overflow → `Err` | `tests/security.test.ts` |

### What Aegis does NOT eliminate (honest limits)

- **Business-logic bugs** — the compiler cannot know that "transfer money to the wrong account" is wrong.
- **Social engineering** — phishing targets humans, not the language.
- **Hardware side-channels** — Spectre, Rowhammer attack the hardware, not the memory model.
- **Dependency backdoors** — we mitigate via signed packages + reproducible builds, but a malicious dependency can still be signed.
- **Flaws in the formal verification itself** — a proof is only as correct as its specification.

---

## What has NOT been independently verified

Every claim above is currently verified **only by the test suite in this
repository**, which was authored by a single agent. Specifically:

- ❌ **No third-party security audit** has been performed.
- ❌ **No formal proof** of the security properties exists (design intent only).
- ❌ **The test suite is single-agent-authored** — the same agent wrote the
  interpreter and the tests. This is a real bias, not dishonesty.
- ✅ **The only independent check** is [CI](https://github.com/Abd123454/aegis/actions):
  GitHub Actions runs the full test suite on every push and pull request.
  If CI passes, the tests pass on a clean machine — but the tests themselves
  are still self-authored.

If you find a way to break any security guarantee, see [SECURITY.md](SECURITY.md).

---

## Run the tests yourself

```bash
bun install      # install dependencies
bun test         # run the full test suite (50 tests across 4 files)
bun run lint     # check code quality
```

The test suite is the executable form of every security claim in this README.
If any test fails, the corresponding security claim is broken.

---

## The interactive playground

The repository includes a Next.js web app that runs the interpreter in the
browser via an API route. To start it:

```bash
bun run dev      # starts on http://localhost:3000
```

Then open the page to try Aegis code interactively, including the 8 exploit
tests (each demonstrates the language rejecting an unsafe pattern).

---

## Repository structure

```
src/lib/aegis/
  interpreter.ts    # tokenizer + parser + analyzer + evaluator (from scratch)
  examples.ts       # curated example programs (safe, exploit, domain, brevity)

tests/
  security.test.ts  # 13 security tests — every exploit MUST be rejected
  brevity.test.ts   # 19 brevity tests — syntax sugar works correctly
  domain.test.ts    # 7 domain tests — general-purpose programming
  regression.test.ts# 11 regression tests — canonical programs keep working

.github/workflows/
  ci.yml            # runs lint + tests on every push/PR

src/app/            # Next.js web app (interactive playground + design doc)
```

---

## License

Apache-2.0. See [LICENSE](LICENSE).

**Why Apache-2.0 over MIT for this project:** Aegis is pitched at
institutional and government adopters who care about patent litigation
risk. Apache-2.0 includes an explicit patent grant (Section 3) and a
patent retaliation clause — if someone sues over patents, they lose
their license. MIT has no patent grant at all. The trade-off: Apache-2.0
is longer and slightly more complex to comply with, but the patent
protection is worth it for a language targeting safety-critical domains.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the RFC process — how language
changes are proposed, discussed, and approved.

## Security disclosure

See [SECURITY.md](SECURITY.md) for how to report a vulnerability in Aegis's
own safety guarantees.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and the
backward-compatibility policy.
