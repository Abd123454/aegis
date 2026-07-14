# Aegis

![CI](https://github.com/Abd123454/aegis/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)
![Status](https://img.shields.io/badge/status-research%20prototype-orange.svg)
![Tests](https://img.shields.io/badge/tests-171%20pass-brightgreen.svg)

> A programming language built from scratch for security-by-construction,
> ease of learning, and universal reach. This repository contains the
> language design document (RFC) and a working reference interpreter for a
> meaningful subset.

**Project status: research prototype / MVP.** Not production-ready. Not
"unhackable." The interpreter is a teaching tool that demonstrates the
security properties; it is NOT a production compiler.

---

## Phase 10: Option/Array/Map type recursion + test isolation (eighth attempt)

The seventh independent review found **no bypasses** but identified 3
non-security issues: two false positives (legitimate code rejected) and
test isolation gaps. Phase 10 is a **light usability + test quality fix**.

### What changed

1. **Fix 1 — `inferType(Try)` unwraps Option**: `(Some(x))?` now infers
   as the type of `x`, not `Option<x>`. This fixes the false positive
   where `(Some(env.fs))?` then `.read()` was rejected.
2. **Fix 2 — `typeHasModuleCap` recurses into option/array/map**: defense-
   in-depth so the gate is robust even if type inference changes.
3. **Fix 3 — Test isolation suite**: 14 new tests in
   `tests/phase10-isolation.test.ts`, each isolating a single static check
   (Fix A, Fix B, return type, implicit return, struct field, typed let,
   impl arg) so the audit can verify each check works independently.
4. **`inferType(Method)` improved**: `unwrap_or`, `get`, `first`, `last`
   now infer correct return types (inner type for unwrap_or, Option<val>
   for get, Option<elem> for first/last).

**Note on syntax**: `Some(x)?` parses as `Some((x)?)` in Aegis — the `?`
binds to the argument, not the constructor. Use `(Some(x))?` to apply `?`
to the Some value. This is documented in the parser.

**171 tests pass** (157 prior + 14 new). 0 failures.

---

## Phase 9: Implicit Return Type Check + Test Suite Audit (seventh attempt)

This is the **SEVENTH attempt** at the ambient-authority guarantee. Round 6
found that Phase 8's return-type check only covered **explicit** `return`
statements. The idiomatic Aegis pattern — last expression in a block as
**implicit return** — bypassed the check entirely. Worse: the Phase 8 test
`LIE-fs-bypass` gave **false confidence** — it used a struct without an
impl for the gated method, so the runtime backstop caught the error, not
the type checker.

**Phase 9 fixes three things:**

1. **Implicit return type check (Fix 1)**: The last `Expr` statement in a
   function body is now type-checked against the declared return type, same
   as explicit `return`. Closes R5-LIE-fs-implicit, R5-sql-implicit,
   R5-cmd-implicit.

2. **Struct literal depth limit (Fix 2)**: `parseStructLit` now calls
   `enterDepth`/`exitDepth`, preventing stack overflow on deeply nested
   struct literals. Closes NEST-struct (exit 137 → clean diagnostic).

3. **Test suite audit (Fix 3)**: Systematically audited all 81 rejection
   tests for false confidence. Found **6 tests** in `phase8-audit.test.ts`
   that used structs WITHOUT impls for gated methods — the runtime backstop
   caught them, not the static check. These gave the impression the type
   checker was working when it wasn't. Full audit in
   [`tests/PHASE9_AUDIT.md`](tests/PHASE9_AUDIT.md).

**We discovered that our test suite had a blind spot that let a real bypass
look fixed for an entire review cycle.** This is the method we now use to
verify tests actually test what they claim: every rejection test must use
a struct WITH a real impl for the gated method, so the runtime backstop
alone would NOT catch it — only the static type check can.

**157 tests pass** (148 prior + 9 new phase-9 tests). 0 failures.

### This is the SEVENTH attempt

- **Phase 4**: name-based → broken by aliasing
- **Phase 5**: value-tracking → broken by wrapping
- **Phase 6**: type system → missing argument-type check
- **Phase 7**: argument-type check → return types still unchecked
- **Phase 8**: all annotation sites checked → implicit returns bypass
- **Phase 9** (this): implicit returns + test suite audit

---

## Phase 8: Verify EVERY Declared Type (Comprehensive Audit)

This is the **SIXTH attempt** at the ambient-authority guarantee. Round 5
found that function RETURN types were declared but never checked — the
exact same bug as Phase 7's parameter-type finding, mirrored.

Instead of patching just return types, Phase 8 is a **comprehensive audit**
of every place the language allows a type annotation. Every site now calls
the same `typesCompatible` function.

### Annotation site coverage table

| # | Site | Verified before Phase 8 | Verified after Phase 8 |
|---|------|-------------------------|------------------------|
| 1 | Function parameters (`fn f(x: T)`) | Yes (Phase 7) | Yes |
| 2 | Function return types (`fn f() -> T`) | **No** | **Yes** (Phase 8) |
| 3 | Struct field declarations (`struct S { x: T }`) | **No** | **Yes** (Phase 8) |
| 4 | Typed `let` bindings (`let x: T = expr`) | **No** | **Yes** (Phase 8) |
| 5 | Impl method parameters | **No** (bodies not walked) | **Yes** (Phase 8) |
| 6 | Impl method return types | **No** (bodies not walked) | **Yes** (Phase 8) |
| 7 | Closure parameters | N/A (no type annotations in Aegis) | N/A |
| 8 | Closure return types | N/A (no type annotations in Aegis) | N/A |

### What changed

- **Return type verification (Site 2)**: `Return` statements now checked against declared return type via `typesCompatible`.
- **Struct field verification (Site 3)**: `StructLit` construction checks each field value's type against the declared field type.
- **Typed let verification (Site 4)**: `let x: T = expr` checks `inferType(expr)` against `T`.
- **Impl method bodies (Sites 5-6)**: Impl method bodies are now type-checked (were skipped entirely before). Built `implParamOrder` table for argument type checking at method call sites.
- **Impl method return types in inferType**: `inferType` now resolves impl method return types via `fnRet` lookup under `"StructName::methodName"`, so `let fs = w.get_fs()` correctly infers `Cap<fs>`.

**148 tests pass** (17 security + 17 brevity + 7 domain + 9 regression +
24 phase-4 adversarial + 23 phase-5 aliased + 13 phase-6 generality +
20 phase-7 type-confusion + 18 phase-8 audit). 0 failures.

**52/52 PoCs verified** across all 5 reviews.

### This is the SIXTH attempt

- **Phase 4**: name-based — broken by aliasing.
- **Phase 5**: value-tracking with enumeration — broken by wrapping.
- **Phase 6**: type-system-based — structurally sound but missing argument-type check.
- **Phase 7**: added argument-type check — but return types still unchecked.
- **Phase 8** (this): comprehensive audit — every annotation site now verified.

**This round is different**: instead of patching one more site, Phase 8
audited ALL sites and produced the coverage table above. A sixth review
should look for soundness gaps in `typesCompatible` itself, not for a
missing annotation site.

---

## Phase 7: Fix the Type Checker's Missing Argument-Type Check

This is the **FIFTH attempt** at the ambient-authority guarantee. The
fourth independent review found the Phase 6 type system's gate was
structurally correct but two typing rules were unsound:

1. The gate allowed gated method names on any user-struct-typed receiver
   without verifying the struct actually defines that method.
2. The type checker never verified call-site argument types against
   declared parameter types.

Together, these let a real `Module` (e.g. `env.fs`) be passed to a function
declaring an unrelated struct-typed parameter, and the gate treated it as
"user struct, no capability" and allowed privileged calls.

**Unlike rounds 1-3, this is not an enumeration gap — it's a straightforward
missing basic type-check.** Phase 7 fixes it directly:

- **Fix A**: Build `implMethods` table. The gate's user-struct branch now
  checks that the struct actually implements the gated method name.
- **Fix B**: `typesCompatible(argTy, paramTy)` checks call-site arguments
  against declared parameter types. A `Cap`-family type is NOT compatible
  with a `struct` type — this closes LIE-9 and all FULL variants.
- **P1**: Depth limit in `walkExpr` (closes NEST-B analyzer crash).
- **P1**: Reject out-of-range integer literals at parse time; handle
  `-2147483648` via special case in `parseUnary`.
- **P2**: Null-checks before `inferType` (closes CRASH-1/2/4).

### Phase 7 fix status

| # | Fix | Status |
|---|---|---|
| A | Gate by impl membership, not just receiver type | **Fixed** — implMethods table + check |
| B | Check call-site argument types | **Fixed** — typesCompatible + diagnostic |
| P1a | Depth limit in walkExpr | **Fixed** — depth tracking (256 max) |
| P1b | Out-of-range integer literals | **Fixed** — reject >2147483647; special-case -2147483648 |
| P2 | Null-check before inferType | **Fixed** — null guards in walkStmt |
| Tests | Regression tests for every PoC | **Done** — 20 tests in `tests/phase7-typeconfusion.test.ts` |
| FP | False-positive checks for legitimate user methods | **Done** — LEGIT-read/fetch/run/query pass |

**130 tests pass** (17 security + 17 brevity + 7 domain + 9 regression +
24 phase-4 adversarial + 23 phase-5 aliased + 13 phase-6 generality +
20 phase-7 type-confusion). 0 failures.

### This is the FIFTH attempt

- **Phase 4**: name-based — broken by aliasing.
- **Phase 5**: value-tracking with enumeration — broken by struct/array/return wrapping.
- **Phase 5 fix**: more enumeration — broken by the next form.
- **Phase 6**: type-system-based — structurally sound but missing basic argument-type check.
- **Phase 7** (this): adds the missing argument-type check + impl membership gate.

**This round is different** from rounds 1-3: it's a genuine missing basic
type-check (standard behavior any real type checker performs), not an
enumeration gap or a deeper design flaw. The type system from Phase 6 was
structurally correct; it just needed the standard call-site type-checking
that every typed language has.

**A fifth independent review should re-attempt the type-confusion pattern**
(passing a capability under an unrelated declared type) with variations
Fix A/B might not cover — e.g. passing through an `Option<MyStruct>`, a
generic collection, or a second layer of indirection.

---

## Phase 6: Real Capability Type System (foundational redesign)

This is the **FOURTH attempt** at the ambient-authority guarantee. The
first three attempts failed because they used **enumeration-based**
approaches — each tracked capability-ness by listing expression forms
that could carry it. Each round closed one form and left another:

- **Phase 4** (attempt 1): name matching (`env`/`cap`). Broken by aliasing.
- **Phase 5** (attempt 2): `isCapExpr` with per-node-kind cases + fixpoint. Broken by struct/array/return-value wrapping.
- **Phase 5 fix** (attempt 3): extended `isCapExpr` to cover more forms. Broken by the next form.

**Phase 6 is structurally different.** It replaces ALL enumeration with a
**type system**. Capability-ness is a TYPE (`Cap`, `Cap<fs>`, `Cap<net>`,
`Cap<shell>`, `Cap<db>`), and it propagates through the **general typing
rules** — field access returns field type, array indexing returns element
type, function calls return return type. There is NO enumeration of
"expression forms that carry capabilities." The gate checks whether the
receiver's TYPE is the right `Cap` type, determined by general typing
rules, not by a hand-enumerated case list.

### Type system design

- **Grammar**: `Cap` (all modules), `Cap<fs>`, `Cap<net>`, `Cap<shell>`, `Cap<db>`
- **Affine** (not linear): Cap values can be moved but not copied. Chosen over linear for ease of learning (Rust's model).
- **Typing rules**: capability-ness propagates through variable binding, struct fields, array/map elements, function parameters and returns, closure captures, and `spawn` — all via general typing rules, not special cases.
- **Soundness**: the gate checks `typeHasModuleCap(typeOf(recv), requiredModule)`. `typeOf` is defined by general typing rules. `typeHasModuleCap` is recursive on types. No expression form can produce a `Cap<fs>` type unless it was derived from a `Cap`-typed value. This generalizes to ANY expression shape.

### Phase 6 fix status

| # | Fix | Status |
|---|---|---|
| 1 | Real type system replacing isCapExpr | **Done** — `inferType` + `typeHasModuleCap` replace all enumeration |
| 2 | Gate on type, not name | **Done** — gate checks `typeHasModuleCap(typeOf(recv), module)` |
| 3 | Runtime backstop kept, secret leak fixed | **Done** — SECRET-1a fixed: cap values print as `<capability>`, Module as `<module>`, Env as `<env>` |
| 4 | Depth limit in type checker | **Done** — `inferType` has depth tracking (256 max) |
| 5 | Generality stress tests | **Done** — 13 new tests in `tests/phase6-generality.test.ts` |
| 6 | All prior PoCs pass | **Done** — 35/35 PoCs from all 3 reviews verified |

**110 tests pass** (17 security + 17 brevity + 7 domain + 9 regression +
24 phase-4 adversarial + 23 phase-5 aliased + 13 phase-6 generality). 0 failures.

### This is the FOURTH attempt

- **Phase 4**: name-based — broken by aliasing.
- **Phase 5**: value-tracking with enumeration — broken by struct/array/return wrapping.
- **Phase 5 fix**: more enumeration — broken by the next form.
- **Phase 6** (this): type-system-based — structurally different because propagation is by general typing rules, not enumeration.

**If a fourth independent review finds this incomplete**, the flaw would
be in the type system itself (an unsound typing rule, a coercion that
shouldn't be allowed, or a way to construct a value with a capability's
runtime shape without having its type) — NOT in a missing expression
form. That is the appropriate adversarial target once enforcement is
structural.

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
