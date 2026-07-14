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
