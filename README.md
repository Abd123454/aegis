# Aegis

![CI](https://github.com/Abd123454/aegis/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)
![Status](https://img.shields.io/badge/status-research%20prototype-orange.svg)
![Tests](https://img.shields.io/badge/tests-96%20pass-brightgreen.svg)

> A programming language built from scratch for security-by-construction,
> ease of learning, and universal reach. This repository contains the
> language design document (RFC) and a working reference interpreter for a
> meaningful subset.

**Project status: research prototype / MVP.** Not production-ready. Not
"unhackable." The interpreter is a teaching tool that demonstrates the
security properties; it is NOT a production compiler.

---

## Phase 5: Capability model redesign (second fix attempt)

A SECOND independent adversarial review found that the Phase 4 fix was
**name-based** — it matched the literal identifiers `env`/`cap` but any
alias (`e`, `alias`, `myenv`) defeated the ambient-authority gate, the
SQL-injection check, AND the command-injection check simultaneously.

Phase 5 replaces name-matching with **capability-value tracking**:
the analyzer now tracks which variables hold capability-tagged values
through an interprocedural fixpoint, and the gate checks whether the
receiver resolves to a cap-tagged value — not whether its name is `env`.

A **runtime backstop** independently verifies the capability marker on
Module values, so even an analyzer miss fails closed.

### Phase 5 fix status

| # | Fix | Status |
|---|---|---|
| 1 | Track capability VALUES, not names | **Fixed** — interprocedural fixpoint propagates cap-tag through aliasing, field access, call sites, and closure captures |
| 2 | Runtime backstop on Module methods | **Fixed** — each Module's `__cap` carries `moduleName:sessionSecret`; forged or mistagged modules rejected at runtime |
| 3 | Integer overflow on `/` and `%` | **Fixed** — `INT_MIN / -1` returns `Err` |
| 4 | Depth limit on ALL recursion | **Fixed** — `parseBlock` and `evalExpr` now have depth tracking (not just `parseExpr`) |
| 5 | Closure `ownScope` regression | **Fixed** — closure params added to `ownScope`; `|x| { x = x + 1; x }` now works |
| 6 | Aliased adversarial tests | **Done** — 22 aliased tests covering AMBIENT-A/B/C/D/E/F, SQL-A/B/C, CMD-A/B, INT-A/B, CLOS-A/B, NEST-A/B/C, runtime backstop, interprocedural flow |

**96 tests pass** (17 security + 17 brevity + 7 domain + 9 regression +
24 phase-4 adversarial + 22 phase-5 aliased). 0 failures.

### This is the SECOND fix attempt for ambient authority

- **Phase 4** (first attempt): name-based matching — broken by aliasing.
- **Phase 5** (this attempt): value-based tracking + runtime backstop.
- **If a third independent review finds this incomplete**, the capability
  model needs a fundamental type-system-level redesign (e.g. a real
  capability type with linear/affine properties), not a third patch.

A third independent review (fresh context, no memory of rounds 1-2)
should be commissioned, focused specifically on whether the
capability-value tracking holds under aliasing, indirection, and the
runtime backstop.

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
| SQL injection | `db.query(template, params)` — template must be plain StrLit; checked even through aliases | **FIXED (P4) + RE-VERIFIED UNDER ALIASING (P5)** |
| Command injection | `shell.run([literal_args])` — all elements must be StrLit; checked even through aliases | **FIXED (P4) + RE-VERIFIED UNDER ALIASING (P5)** |
| Data race | `static mut` forbidden (incl. newlines); `spawn(move, ...)` required | **PARTIALLY MITIGATED** — compile-time design intent only; reference interpreter runs `spawn` synchronously |
| Ambient authority | Capability-value tracking (interprocedural fixpoint); `env` not a global; runtime backstop on Module methods | **FIXED (P4) + REDESIGNED (P5)** — second fix attempt; tracks values not names |
| Integer overflow | Checked on `+`, `-`, `*`, `/`, `%`, unary `-`; oversized literals rejected | **FIXED (P4) + EXTENDED to `/` and `%` (P5)** |
| Forged capability modules | `Module`/`Env`/`TaskHandle` names reserved; runtime backstop verifies `__cap` tag | **FIXED (P4) + RUNTIME BACKSTOP (P5)** |
| Closure mutation | Captured variables cannot be mutated; rejected at analysis; closure params can be reassigned | **FIXED (P4) + REGRESSION FIXED (P5)** |
| Deep nesting DoS | Parser depth limit (256) on all recursion; evaluator depth limit (512) | **FIXED (P4) + EXTENDED to all paths (P5)** |

### What Aegis does NOT eliminate (honest limits)

- **Business-logic bugs** — the compiler cannot know that "transfer money to the wrong account" is wrong.
- **Social engineering** — phishing targets humans, not the language.
- **Hardware side-channels** — Spectre, Rowhammer attack the hardware, not the memory model.
- **Dependency backdoors** — we mitigate via signed packages + reproducible builds, but a malicious dependency can still be signed.
- **Flaws in the formal verification itself** — a proof is only as correct as its specification.
- **Runtime data races** — the reference interpreter runs `spawn` synchronously, so the data-race guarantee is a compile-time design intent only.

---

## What has NOT been independently verified

TWO independent adversarial reviews have been performed:
- **Phase 4 review**: found 27/39 exploits succeeded (name-based bypasses).
- **Phase 5 review**: found the Phase 4 fix was name-based and defeated by aliasing.

The Phase 5 fixes were written by the **same agent** that wrote the code
being fixed. Specifically:

- ✅ **Two independent adversarial reviews** have been performed (Phase 4 + Phase 5).
- ❌ **A THIRD independent review has NOT been performed.** The Phase 5 fixes
  were written by the same agent whose code was just broken twice. A third
  review with fresh context (no memory of rounds 1-2) is needed, focused
  specifically on whether the capability-value tracking holds under
  aliasing, indirection, and the runtime backstop.
- ❌ **No formal proof** of the security properties exists (design intent only).
- ❌ **The test suite is still single-agent-authored** — the same agent wrote
  the interpreter, the original tests, the Phase 4 adversarial tests, AND the
  Phase 5 aliased tests. The aliased tests use different variable names, but
  the review that identified the aliasing attack was also AI-authored.
- ✅ **[CI](https://github.com/Abd123454/aegis/actions)** runs the full test
  suite (89 tests) on every push. If CI passes, the tests pass on a clean
  machine — but the tests themselves are self-authored.
- ⚠️ **If a third review finds the capability-value tracking incomplete**, the
  capability model needs a fundamental type-system-level redesign (e.g. a real
  capability type with linear/affine properties), not a third patch.

If you find a way to break any security guarantee, see [SECURITY.md](SECURITY.md).

---

## Run the tests yourself

```bash
bun install      # install dependencies
bun test         # run the full test suite (89 tests across 6 files)
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
