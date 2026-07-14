# Aegis

![CI](https://github.com/Abd123454/aegis/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)
![Status](https://img.shields.io/badge/status-research%20prototype-orange.svg)
![Tests](https://img.shields.io/badge/tests-74%20pass-brightgreen.svg)

> A programming language built from scratch for security-by-construction,
> ease of learning, and universal reach. This repository contains the
> language design document (RFC) and a working reference interpreter for a
> meaningful subset.

**Project status: research prototype / MVP.** Not production-ready. Not
"unhackable." The interpreter is a teaching tool that demonstrates the
security properties; it is NOT a production compiler.

---

## Phase 4: Adversarial review and vulnerability fixes

An independent adversarial review cloned this repository, read the source
directly, and ran 39 novel exploit attempts against the 8 security claims.
**27 succeeded.** 4 of 8 claims had runnable counterexamples; 1 more was
only accidentally enforced. The central claim — ambient authority
prevention — was broken via 3 independent bypasses.

This phase fixes all 12 items from the review's fix list. The status of
each fix, verified against the EXACT proof-of-concept code from the review:

| # | Fix | Status |
|---|---|---|
| 1 | Remove `env` from globals | **Fixed and re-verified** — PoCs A1, A3, A4 rejected |
| 2 | Walk `StrLit` in analyzer | **Fixed and re-verified** — PoCs I1, I2, S2 rejected |
| 3 | Reject forged `Module` structs | **Fixed and re-verified** — PoCs F1, F2, F3 rejected |
| 4 | Validate `db.query` template shape | **Fixed and re-verified** — PoCs S1, S2 rejected |
| 5 | Validate `shell.run` array elements | **Fixed and re-verified** — PoC S3 rejected |
| 6 | Check overflow on ALL operators | **Fixed and re-verified** — PoCs O1, O3, O5 rejected |
| 7 | Fix `Cap<...>` type parsing | **Fixed and re-verified** — `Cap<fs>` now recognized |
| 8 | Fix `static\nmut` tokenizer bypass | **Fixed and re-verified** — PoC D1 rejected |
| 9 | Parser recursion depth limit | **Fixed and re-verified** — PoC L12 produces clean error |
| 10 | Make `spawn` concurrent or relabel | **Partially mitigated** — `spawn` is still synchronous in the reference interpreter; the data-race guarantee is a compile-time design intent (`static mut` rejected, `move` required) not a runtime-enforced property. The README claim is updated below. |
| 11 | Fix closure mutation | **Fixed and re-verified** — PoCs C1, C2 rejected at analysis |
| 12 | Regression tests for every bypass | **Done** — 24 adversarial tests in `tests/adversarial.test.ts` |

**All 74 tests pass** (50 original + 24 adversarial). Every PoC from the
review is now rejected.

### What this means for the threat table

The threat table below is updated to reflect what is now actually true.
Claims that were broken and are now fixed are marked **FIXED**. Claims
that are only partially enforced are marked **PARTIALLY MITIGATED**.

| Vulnerability class | Mechanism | Status |
|---|---|---|
| Buffer overflow | Array indexing returns `Option<T>`; OOB → `None` | Enforced |
| Use-after-free / double-free | No `malloc`/`free`; ownership-based memory | Enforced |
| Null dereference | No `null` literal; use `Option<T>` | Enforced |
| SQL injection | `db.query(template, params)` — template must be plain StrLit | **FIXED** (was bypassable via concatenation/interpolation) |
| Command injection | `shell.run([literal_args])` — all elements must be StrLit | **FIXED** (was bypassable via variables in argv) |
| Data race | `static mut` forbidden (incl. newlines); `spawn(move, ...)` required | **PARTIALLY MITIGATED** — compile-time design intent only; reference interpreter runs `spawn` synchronously |
| Ambient authority | `env` not a global; reachable only via `Cap` parameter; StrLit interpolation analyzed; forged `Module` rejected | **FIXED** (was broken via 3 bypasses) |
| Integer overflow | Checked on `+`, `-`, `*`, unary `-`; oversized literals rejected | **FIXED** (was only checked on `+` upper bound) |
| Forged capability modules | `Module`/`Env`/`TaskHandle` names reserved; cannot be constructed | **FIXED** (was forgeable) |
| Closure mutation | Captured variables cannot be mutated; rejected at analysis | **FIXED** (was silently no-op) |
| Deep nesting DoS | Parser depth limit (256); clean error instead of RangeError | **FIXED** (was uncaught stack overflow) |

### What Aegis does NOT eliminate (honest limits)

- **Business-logic bugs** — the compiler cannot know that "transfer money to the wrong account" is wrong.
- **Social engineering** — phishing targets humans, not the language.
- **Hardware side-channels** — Spectre, Rowhammer attack the hardware, not the memory model.
- **Dependency backdoors** — we mitigate via signed packages + reproducible builds, but a malicious dependency can still be signed.
- **Flaws in the formal verification itself** — a proof is only as correct as its specification.
- **Runtime data races** — the reference interpreter runs `spawn` synchronously, so the data-race guarantee is a compile-time design intent only.

---

## What has NOT been independently verified

An independent adversarial review was performed in Phase 4 and found 27/39
exploit attempts succeeded. The fixes above were written by the **same agent**
that wrote the interpreter and the original tests. Specifically:

- ✅ **One independent adversarial review** was performed (Phase 4). It found
  27 exploits that succeeded. All 12 fix-list items have been addressed.
- ❌ **A SECOND independent review has NOT been performed.** The Phase 4 fixes
  were written by the same agent whose code was just broken. A second review
  is needed before any of these claims can be trusted again.
- ❌ **No formal proof** of the security properties exists (design intent only).
- ❌ **The test suite is still single-agent-authored** — the same agent wrote
  the interpreter, the original tests, AND the adversarial regression tests.
  The adversarial tests use the exact PoC shapes from the review, but the
  review itself was also AI-authored, so this is not fully independent.
- ✅ **[CI](https://github.com/Abd123454/aegis/actions)** runs the full test
  suite (74 tests) on every push. If CI passes, the tests pass on a clean
  machine — but the tests themselves are self-authored.

If you find a way to break any security guarantee, see [SECURITY.md](SECURITY.md).

---

## Run the tests yourself

```bash
bun install      # install dependencies
bun test         # run the full test suite (74 tests across 5 files)
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
