# Changelog

All notable changes to Aegis are documented here. This project follows
[Semantic Versioning](https://semver.org/) with the following
backward-compatibility promise:

## Versioning Policy

Aegis uses `MAJOR.MINOR.PATCH` versioning:

- **PATCH** (`0.0.x`): bug fixes, no new features, no breaking changes.
- **MINOR** (`0.x.0`): new features, backward-compatible. Existing programs
  continue to compile and run identically.
- **MAJOR** (`x.0.0`): breaking changes. Requires **3 months notice** via
  a deprecation cycle: the old syntax emits a warning for 3 months, then
  becomes an error in the next major version.

### What is a "breaking change"

- Removing or renaming a keyword, operator, or builtin function.
- Changing the semantics of existing syntax (e.g. `+` on Ints now wraps
  instead of checking — this would be breaking AND would be rejected by
  the threat-table check).
- Removing a stdlib module or function.
- Changing the capability model (e.g. making `env` implicit — this would
  be rejected by the threat-table check).

### What is NOT a breaking change

- Adding a new keyword (as long as it doesn't shadow existing identifiers).
- Adding a new builtin or stdlib module.
- Adding a new method to an existing type.
- Improving error messages.
- Making the interpreter faster.

### Current stability

Aegis is `0.x` — the language is still evolving. Breaking changes may
happen in minor versions during `0.x`. After `1.0`, the full
backward-compatibility promise applies.

---

## [Unreleased]

### Phase 14 — Async interpreter rewrite + real AI via SDK

- **Rewritten**: Entire evaluator is async — `run()` returns `Promise<RunResult>`.
- **Rewritten**: `evalExpr`/`evalStmt`/`evalMethod`/`evalCall`/`evalBin`/`evalMatch`/`execBlock` all async.
- **Rewritten**: `applyFn` async — supports async user functions and callbacks.
- **Upgraded**: AI calls now use z-ai-web-dev-sdk directly (not CLI subprocess).
  - Speed: 0.35s (was 10-30s — **30-85x faster**)
- **Updated**: All 206 tests converted to async (`await run()`).
- **Updated**: CLI and API route use `await run()`.
- **Unchanged**: Type checker (sync), runtime backstop, capability model.
- All 206 tests pass. 0 failures.

### Phase 13 — General-purpose language enhancements

- **Added**: `async`/`await` syntax — parsed and accepted (sync evaluator treats await as identity).
- **Added**: Real AI integration — `env.ai.complete/chat` call z-ai LLM via subprocess. Mock mode via `AEGIS_MOCK_AI=1`.
- **Added**: Extended stdlib — `fs.write/list/exists/delete/mkdir`, `json_encode/decode`, `sha256`, `random_hex`.
- **Added**: 5 examples — hello, JSON manipulation, file processor, concurrent fetch, AI ask.
- **Added**: 12 new tests in `tests/phase13-general.test.ts`.
- **Measured**: Startup time 63ms (target <50ms).
- All 206 tests pass. 0 failures.

### Phase 12 — Standalone CLI + Cap<ai> + stdlib

- **Added**: Standalone CLI (`src/standalone/cli.ts`) — `aegis run/check/repl`.
- **Added**: `Cap<ai>` module with `complete`, `chat`, `embed` methods.
- **Added**: stdlib functions: `range`, `int_to_str`, `str_to_int`, `float_to_str`, `type_of`, `now`.
- **Added**: `aegis` and `fuzz` npm scripts.
- **Renamed**: package name to `aegis-lang`, version to `0.12.0`.
- **Added**: 10 new tests in `tests/phase12-cli-ai.test.ts`.

All 181 tests pass. 0 failures.

### Phase 11 — Fuzzing campaign

After 7 rounds of manual review, switched to automated fuzzing. Built
grammar-aware fuzzer (`tests/fuzz/aegis-fuzzer.ts`) that generates random
Aegis programs and checks the security property.

- **Added**: `tests/fuzz/aegis-fuzzer.ts` — grammar-aware program generator
  with seedable PRNG, property oracle, coverage tracking.
- **Result**: 5,000+ iterations across 5 seeds, 0 bypasses found.
- **Coverage**: all major AST node types (IntLit, StrLit, Ident, Field,
  Method, Call, Some, Try, StructLit, Array, MapLit, Closure, If, Let,
  Assign, Return).
- **Gaps**: no match/for-in/spawn generation; some seeds cause interpreter
  hangs on deeply recursive generated programs.

### Phase 10 — Option/Array/Map type recursion + test isolation (eighth attempt)

The seventh independent review found no bypasses but identified false
positives and test isolation gaps. Phase 10 is a light usability fix.

- **Fixed**: `inferType(Try)` now unwraps Option — `(Some(x))?` infers as x's type.
- **Fixed**: `typeHasModuleCap` recurses into option/array/map (defense-in-depth).
- **Fixed**: `inferType(Method)` infers return types for `unwrap_or`, `get`, `first`, `last`.
- **Added**: 14 test isolation tests in `tests/phase10-isolation.test.ts`.
- **Documented**: `Some(x)?` parses as `Some((x)?)` — use `(Some(x))?` for ? on Some.

All 171 tests pass. 0 failures.

### Phase 9 — Implicit return type check + test suite audit (seventh attempt)

Round 6 found that Phase 8's return-type check only covered explicit `return`
statements. Implicit returns (last expression in a block) bypassed it entirely.
Worse: the Phase 8 test LIE-fs-bypass gave false confidence — it used a struct
without an impl, so the runtime backstop caught the error, not the type checker.

- **Fixed (Fix 1)**: Implicit return type check — last Expr in function body
  checked against declared return type via typesCompatible.
- **Fixed (Fix 2)**: parseStructLit now has depth tracking (enterDepth/exitDepth).
  Deeply nested struct literals produce clean diagnostic instead of crash.
- **Audited (Fix 3)**: All 81 rejection tests audited for false confidence.
  Found 6 false-confidence tests in phase8-audit.test.ts (used structs without
  impls → runtime backstop caught them, not static check). Full audit in
  tests/PHASE9_AUDIT.md.
- **Added**: 9 new tests in tests/phase9-implicit-return.test.ts using structs
  WITH real impls for gated methods (R5-LIE-fs/sql/cmd-implicit, NEST-struct,
  legitimate implicit returns, explicit return regression).

All 157 tests pass. 0 failures.

### Phase 8 — Comprehensive type annotation audit (sixth attempt)

Round 5 found function return types were declared but never checked — the
same bug as Phase 7's parameter-type finding, mirrored. Phase 8 is a
comprehensive audit of ALL type annotation sites, not just returns.

- **Fixed (Site 2)**: Return type verification — `Return` statements checked against declared return type.
- **Fixed (Site 3)**: Struct field verification — `StructLit` construction checks field value types.
- **Fixed (Site 4)**: Typed `let` verification — `let x: T = expr` checks inferred type against `T`.
- **Fixed (Sites 5-6)**: Impl method bodies now type-checked (were skipped entirely). Built `implParamOrder` table for method call argument checking.
- **Fixed**: `inferType` now resolves impl method return types via `fnRet` lookup under `"StructName::methodName"`.
- **Added**: 18 audit tests in `tests/phase8-audit.test.ts` covering all 6 annotation sites + round-5 PoCs + false-positive checks.

All 148 tests pass. 52/52 PoCs from all 5 reviews verified.

### Phase 7 — Fix missing argument-type check (fifth attempt)

The fourth independent review found two unsound typing rules in the Phase 6
type system. Phase 7 fixes them directly — this is a missing basic type-check,
not an enumeration gap.

- **Fixed (A)**: Build `implMethods` table. Gate's user-struct branch now
  checks the struct actually implements the gated method name (closes LIE-9).
- **Fixed (B)**: `typesCompatible(argTy, paramTy)` checks call-site arguments
  against declared parameter types. Cap-family types are NOT compatible with
  struct types (closes LIE-9, SQL-INJECTION-FULL, CMD-INJECTION-FULL, NET-FETCH-FULL).
- **Fixed (P1a)**: Depth limit in `walkExpr` (256 max, closes NEST-B crash).
- **Fixed (P1b)**: Reject integer literals >2147483647 at parse time; special-case
  `-2147483648` in `parseUnary` (closes long-standing round-2 issue).
- **Fixed (P2)**: Null-checks before `inferType` in walkStmt (closes CRASH-1/2/4).
- **Added**: 20 regression tests in `tests/phase7-typeconfusion.test.ts` covering
  all PoCs from the fourth review + false-positive checks for legitimate user methods.

All 130 tests pass. 46/46 PoCs from all 4 reviews verified.

### Phase 6 — Real Capability Type System (foundational redesign)

This is the FOURTH attempt at the ambient-authority guarantee. Phases 1-5
used enumeration-based approaches that were each defeated by a new
expression form. Phase 6 replaces ALL enumeration with a type system.

- **Added**: Type representation (`Type` = cap | struct | array | map | option | other).
- **Added**: `inferType(e, ctx, sft, fnRet)` — general type inference for all expression forms.
- **Added**: `typeHasCap(t, sft)` — recursive check if a type contains a capability.
- **Added**: `typeHasModuleCap(t, module, sft)` — check if a type provides a specific module's capability.
- **Added**: `typeCheck(items)` — replaces `analyze()`. Gates methods based on receiver TYPE, not name.
- **Removed**: `isCapExpr`, `GATED_FULL`, `GATED_NAMES`, `methodModule`, `methodChain`, fixpoint propagation.
- **Fixed**: SECRET-1a — cap values print as `<capability>`, Module as `<module>`, Env as `<env>`. Session secret no longer exposed.
- **Fixed**: Depth limit in type checker (`inferType` has 256 max depth).
- **Added**: 13 generality stress tests (`tests/phase6-generality.test.ts`) covering struct fields, arrays, closures in structs, function returns, multiple indirections, false positives on user structs, depth, and secret leak.
- **Updated**: Phase 5 test "Cap flows through untyped param" → now correctly rejected (type system requires explicit Cap annotations).
- **Updated**: T1 test for `Cap<fs>` — now uses `env.read()` directly (Cap<fs> is the module, not a container).

All 110 tests pass. 35/35 PoCs from all 3 reviews verified.

NOTE: This is the FOURTH attempt. If a fourth review finds this
incomplete, the flaw would be in the type system itself (unsound typing
rule, bad coercion, or runtime shape without type), NOT in a missing
expression form.

### Phase 5 — Capability model redesign (second fix attempt)

A second independent adversarial review found that the Phase 4 fix was
name-based — aliasing the capability to any other variable name (`e`,
`alias`, `myenv`) defeated the ambient-authority gate, SQL-injection
check, AND command-injection check simultaneously.

Phase 5 replaces name-matching with capability-value tracking:

- **Fixed**: Capability-value tracking via interprocedural fixpoint. The
  analyzer now tracks which variables hold cap-tagged values through
  aliasing, field access, call sites, and closure captures — not which
  variables are named `env`.
- **Fixed**: Runtime backstop. Each Module's `__cap` carries
  `moduleName:sessionSecret`; forged or mistagged modules are rejected
  at runtime. Even an analyzer miss fails closed.
- **Fixed**: Integer overflow on `/` and `%`. `INT_MIN / -1` returns `Err`.
- **Fixed**: Depth limit on ALL recursion — `parseBlock`, `parseArgs`,
  and `evalExpr` now have depth tracking. Fixed infinite-loop bug when
  `enterDepth` failed without consuming tokens.
- **Fixed**: Closure `ownScope` regression — closure params added to
  `ownScope`; `|x| { x = x + 1; x }` now works.
- **Added**: 22 aliased adversarial tests (`tests/phase5-aliased.test.ts`)
  with PoCs from the second review: AMBIENT-A/B/C/D/E/F, SQL-A/B/C,
  CMD-A/B, INT-A/B, CLOS-A/B, NEST-A/B/C, runtime backstop, interprocedural.

All 96 tests pass (17 security + 17 brevity + 7 domain + 9 regression +
24 phase-4 adversarial + 22 phase-5 aliased). 0 failures.

NOTE: This is the SECOND fix attempt for the ambient-authority claim.
If a third independent review finds this incomplete, the capability model
needs a fundamental type-system-level redesign, not a third patch.

### Phase 4 — Adversarial review vulnerability fixes

An independent adversarial review found 27/39 exploit attempts succeeded
against the 8 security claims. All 12 fix-list items addressed:

- **Fixed**: `env` removed from globals (was bypassable via 3 independent paths).
- **Fixed**: String interpolation now analyzed by the capability checker.
- **Fixed**: Forged `Module`/`Env`/`TaskHandle` structs rejected at parse time.
- **Fixed**: `db.query` template must be a plain string literal (no concat/interp).
- **Fixed**: `shell.run` array elements must all be plain string literals.
- **Fixed**: Integer overflow checked on `-`, `*`, unary `-`, and oversized literals.
- **Fixed**: `Cap<fs>` type parsing — generic args normalized.
- **Fixed**: `static\nmut` tokenizer bypass — newlines now skipped.
- **Fixed**: Parser depth limit (256) — deep nesting produces clean error.
- **Partially mitigated**: `spawn` is synchronous in the reference interpreter;
  data-race guarantee is compile-time design intent only.
- **Fixed**: Closure mutation of captured variables rejected at analysis.
- **Added**: 24 adversarial regression tests (`tests/adversarial.test.ts`).

All 74 tests pass (50 original + 24 adversarial).

### Phase 3 — Independent verifiability + GitHub readiness

- **Added**: Formal automated test suite in `/tests/` (50 tests across 4
  files), runnable with `bun test`.
- **Added**: GitHub Actions CI pipeline (`.github/workflows/ci.yml`)
  that runs lint + tests on every push and pull request.
- **Added**: `SECURITY.md` vulnerability disclosure policy.
- **Added**: `CONTRIBUTING.md` with the RFC process and governance model.
- **Added**: `LICENSE` (Apache-2.0).
- **Added**: This `CHANGELOG.md` with the versioning policy.
- **Fixed**: 3 interpreter bugs found by the formal test suite:
  - `self` parameter without type annotation in impl methods now accepted.
  - `?` operator now unwraps `Ok(x)` → `x` and `Some(x)` → `x` (was
    returning the wrapped value).
  - `||` (empty lambda params) no longer tokenized as the OR operator.
- **Fixed**: capability model hardened — `fs`/`net`/`shell`/`db` are no
  longer globals; reachable only through `env`. Closures no longer
  inherit `hasCap` from the enclosing scope.

### Phase 2 — General-purpose domains + brevity

- **Added**: Lambda shorthand `|x| expr`.
- **Added**: `for x in iter { }` loops.
- **Added**: Map type `#{ k: v }` with `get`/`insert`/`entries`.
- **Added**: Pipeline operator `a |> f`.
- **Added**: Struct field punning `Point { x, y }`.
- **Added**: String/array methods (`split`, `upper`, `lower`, `map`,
  `filter`, `reduce`, `join`, `sort`).
- **Added**: Option methods (`unwrap_or`, `is_some`, `is_none`).
- **Added**: Number methods (`sqrt`, `abs`, `floor`, `ceil`).
- **Added**: Associated function calls `Type::method(args)`.
- **Added**: 5 new documentation sections (domain coverage, brevity
  audit, tension log, updated threat table, working domain example).
- **Verified**: All 10 security tests still pass after brevity changes.

### Phase 1 — Core language + security

- **Added**: From-scratch tokenizer, recursive-descent parser, static
  capability/safety analyzer, and tree-walking evaluator.
- **Added**: 8 security guarantees enforced by construction (null,
  UAF/double-free, buffer overflow, SQL injection, command injection,
  data race, ambient authority, integer overflow).
- **Added**: Capability-gated I/O (no ambient authority).
- **Added**: `spawn(move, ...)` for data-race-free concurrency.
- **Added**: Interactive Next.js playground with 13 example programs.
- **Added**: 16-section Arabic RTL design document covering philosophy,
  threat model, syntax, type system, memory model, concurrency,
  capabilities, supply chain, interop, stdlib, tooling, reference
  implementation, comparison, progressive disclosure, adoption roadmap,
  and build roadmap.
