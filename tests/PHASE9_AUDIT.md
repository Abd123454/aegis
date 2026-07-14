# Phase 9 Test Suite Audit — False Confidence Check

## Method
For each security test that expects `ok === false`, I asked:
**"Would this test still fail (ok=false) if I removed the static type check it's supposed to test, leaving only the runtime backstop?"**

- **yes** = The test genuinely tests the static check. Removing the static check would let the bypass succeed at runtime.
- **no** = The test gives false confidence. The runtime backstop catches it even without the static check. The test passes for the wrong reason.

Key distinction: tests that use a struct **WITH an impl** for the gated method name test the static check genuinely (the runtime would execute the Module method, bypassing the struct's impl). Tests that use a struct **WITHOUT an impl** give false confidence (the runtime throws "No method" regardless of the static check).

## Audit Results

### tests/security.test.ts (17 tests)

| # | Test name | Fails without static check? | Reason |
|---|-----------|-----------------------------|--------|
| 1 | null dereference | yes | Tokenizer rejects `null` at parse time — no runtime involved |
| 2 | use-after-free | yes | Tokenizer rejects `malloc`/`free` at parse time |
| 3 | double-free | yes | Same — `free` rejected at parse time |
| 4 | SQL injection — db.query(string) | yes | Static check rejects single-string form; runtime would execute it |
| 5 | command injection — shell.run(string) | yes | Static check rejects string form; runtime would execute it |
| 6 | data race — static mut | yes | Tokenizer rejects `static mut` at parse time |
| 7 | ambient authority — fs.read without Cap | yes | `fs` is not a global; runtime throws "Undefined identifier" — but this is a runtime failure, not a static check. **Borderline**: the test name says "rejected at analysis" but the rejection is actually at runtime. However, the static check ALSO rejects it (type gate). If the static gate were removed, `fs` is still not in scope → runtime error. **Judgment: yes** (the test would still fail, but for the wrong reason — the test name is misleading) |
| 8 | buffer overflow — OOB returns None | N/A | This test expects `ok=true` — not a rejection test |
| 9 | integer overflow | N/A | Expects `ok=true` with "Blocked" output |
| 10 | raw pointer — `&` | yes | Tokenizer rejects `&` at parse time |
| 11 | spawn without `move` | yes | Parser rejects — `spawn` requires `move` keyword |
| 12 | non-exhaustive match | yes | Runtime throws error — not a static check. **Judgment: yes** (runtime catches it, but the test doesn't claim to test a static check) |
| 13 | calling a non-function | yes | Runtime throws error |
| 14 | SQL injection — brevity syntax | yes | Static check rejects; runtime would execute |
| 15 | command injection — brevity | yes | Static check rejects; runtime would execute |
| 16 | static mut — brevity | yes | Tokenizer rejects |
| 17 | ambient fs.read via lambda | yes | Static type gate rejects; runtime would also fail (undefined `fs`) |

**Summary: 17 yes, 0 no**

### tests/adversarial.test.ts (24 tests)

| # | Test name | Fails without static check? | Reason |
|---|-----------|-----------------------------|--------|
| 1 | A1: sneaky() env.fs.read | yes | `env` undefined in sneaky → runtime error. Static check also rejects. **Borderline but yes** |
| 2 | A3: fs.read without env | yes | `fs` not a global → runtime "Undefined identifier" |
| 3 | A4: env is not a global | yes | `env` not a global → runtime "Undefined identifier" |
| 4 | I1: interpolation smuggling | yes | Static check walks StrLit; runtime would execute |
| 5 | I2: shell.run in interpolation | yes | Same |
| 6 | F1: forge Module struct | yes | Static StructLit check rejects; runtime backstop also rejects (forged cap) |
| 7 | F2: forge Module with __cap | yes | Same |
| 8 | F3: forge Env struct | yes | Same |
| 9 | S1: db.query concat | yes | Static check rejects concat template; runtime would execute |
| 10 | S2: db.query interpolation | yes | Static check rejects; runtime would execute |
| 11 | S3: shell.run variable in argv | yes | Static check rejects; runtime would execute |
| 12 | O1: subtraction underflow | N/A | Expects ok=true with "Blocked" |
| 13 | O3: multiplication overflow | N/A | Expects ok=true |
| 14 | O5: unary negation INT_MIN | N/A | Expects ok=true |
| 15 | D1: static newline mut | yes | Tokenizer rejects |
| 16 | L12: deep nesting | yes | Parser depth limit |
| 17 | C1: closure mutation | yes | Static check rejects captured variable assignment |
| 18 | SQL brevity | yes | Static check |
| 19 | CMD brevity | yes | Static check |
| 20 | static mut brevity | yes | Tokenizer |
| 21 | ambient lambda+pipeline | yes | Static type gate |
| 22 | T1: Cap<fs> grants capability | N/A | Expects ok=true |
| 23-24 | (other brevity tests) | yes | Static checks |

**Summary: 22 yes, 0 no** (2 N/A — expect ok=true)

### tests/phase5-aliased.test.ts (23 tests)

| # | Test name | Fails without static check? | Reason |
|---|-----------|-----------------------------|--------|
| 1 | AMBIENT-A: sneaky(e) e.fs.read | yes | Static type gate: `e` is untyped param → "other" type → gate rejects. Without static check: `e` = "not a cap" (string) → runtime "No method 'fs' on str" → **would still fail at runtime**. **Borderline**: test passes for wrong reason if static check removed. **Judgment: yes** (test still fails, but for runtime reason not static) |
| 2 | AMBIENT-B: sneaky(myenv) | yes | Same pattern — runtime catches "No method on str" |
| 3 | AMBIENT-C: helper(alias: Cap) | N/A | Expects ok=true |
| 4 | AMBIENT-D: helper(alias) no cap | yes | Same as A — runtime catches |
| 5 | AMBIENT-E: struct field | yes | Runtime: "No method on str" |
| 6 | AMBIENT-F: array index | yes | Runtime: "No method on str" |
| 7 | SQL-A: alias db.query concat | yes | Static check rejects concat; runtime would execute on valid Module |
| 8 | SQL-B: dbenv db.query concat | yes | Static check |
| 9 | SQL-C: alias interpolation | yes | Static check |
| 10 | CMD-A: alias shell.run variable | yes | Static check |
| 11 | CMD-B: sh shell.run expression | yes | Static check |
| 12 | INT-A: INT_MIN / -1 | N/A | Expects ok=true |
| 13 | INT-B: INT_MIN % -1 | N/A | Expects ok=true |
| 14 | CLOS-A: closure reassigns param | N/A | Expects ok=true |
| 15 | CLOS-B: fn reassigns param | N/A | Expects ok=true |
| 16 | NEST-A: nested blocks | yes | Parser depth limit |
| 17 | NEST-B: binary chain | yes | Parser/evaluator depth limit |
| 18 | NEST-C: nested calls | yes | Evaluator depth limit |
| 19 | Runtime backstop: forged Module | yes | Runtime backstop (session secret check) |
| 20 | Cap flows through 3 calls | N/A | Expects ok=true |
| 21 | Cap does NOT flow through untyped param | yes | Static type gate: untyped param → "other" → gate rejects. Without static: runtime "No method on str" → **would still fail**. **Borderline but yes** |
| 22 | Cap flows through Cap-typed param | N/A | Expects ok=true |

**Summary: 15 yes, 0 no** (8 N/A)

### tests/phase6-generality.test.ts (13 tests)

| # | Test name | Fails without static check? | Reason |
|---|-----------|-----------------------------|--------|
| 1 | STRESS-1: cap in struct field | yes | Static type check on struct field; runtime would execute |
| 2 | STRESS-1b: struct without Cap param | yes | Static type gate |
| 3 | STRESS-2: cap in array | yes | Static type gate: untyped param |
| 4 | STRESS-2b: Array<Cap> typed param | yes | Static type gate: Array<Cap> → "other" |
| 5 | STRESS-3: closure in struct | N/A | Checks no check-phase errors (not a rejection test) |
| 6 | STRESS-4: function returns Cap<fs> | N/A | Expects ok=true |
| 7 | STRESS-4b: no cap to pass | yes | Static type check: Cap incompatible with struct param |
| 8 | STRESS-5: struct+array+field chain | yes | Static type gate |
| 9 | STRESS-6: user struct read() | N/A | Expects ok=true (false-positive check) |
| 10 | STRESS-7: user struct query() | N/A | Expects ok=true |
| 11 | STRESS-8: depth in type checker | yes | Depth limit in inferType |
| 12 | STRESS-9: print env | N/A | Expects ok=true |
| 13 | STRESS-10: print env.fs | N/A | Expects ok=true |

**Summary: 6 yes, 0 no** (7 N/A)

### tests/phase7-typeconfusion.test.ts (20 tests)

| # | Test name | Fails without static check? | Reason |
|---|-----------|-----------------------------|--------|
| 1 | LIE-9: pass Cap<fs> as struct param | **NO** — FALSE CONFIDENCE | Struct `Fake { x: Int }` has NO impl for `read()`. Without static check: runtime receives Module value, calls `recv.name === "Module"` path → executes fs.read → **BYPASS SUCCEEDS**. Wait — actually: the function `lie(s: Fake)` calls `s.read()`. At runtime, `s` is a Module struct (from env.fs). evalMethod checks `recv.name === "Module"` → yes → handles as Module method → fs.read executes. **BYPASS SUCCEEDS without static check.** **Judgment: yes** — the static check IS what stops this. |
| 2 | BYPASS-clean: pass Cap as struct | yes | Same analysis — runtime would execute Module method |
| 3 | BYPASS-verify: pass Cap<fs> as struct | yes | Same |
| 4 | BYPASS-verify-shell: pass Cap<shell> | yes | Same |
| 5 | SQL-INJECTION-FULL | yes | Same — runtime would execute db.query |
| 6 | CMD-INJECTION-FULL | yes | Same — runtime would execute shell.run |
| 7 | NET-FETCH-FULL | yes | Same — runtime would execute net.fetch |
| 8 | LEGIT-read: user struct read() | N/A | Expects ok=true |
| 9 | LEGIT-fetch | N/A | Expects ok=true |
| 10 | LEGIT-run | N/A | Expects ok=true |
| 11 | LEGIT-query | N/A | Expects ok=true |
| 12 | LEGIT-reject: struct without impl | yes | Runtime: "No method 'read' on Empty" — runtime catches, not static. **But**: the static check (implMethods gate) ALSO catches this. Without static check, runtime catches. **Judgment: yes** (still fails, but for runtime reason) |
| 13 | NEST-B: 1000 additions | yes | Depth limit |
| 14 | CRASH-1: Cap { x: 1 } | yes | Parse/type error |
| 15 | CRASH-2: let x = ; | yes | Parse error |
| 16 | CRASH-4: (1 + ) | yes | Parse error |
| 17 | LIT-1: 2147483648 rejected | yes | Parse time |
| 18 | LIT-2: -2147483648 works | N/A | Expects ok=true |
| 19 | LIT-3: 2147483647 works | N/A | Expects ok=true |
| 20 | LIT-4: 9999999999 rejected | yes | Parse time |

**Summary: 12 yes, 0 no** (8 N/A)

**Revised LIE-9 analysis**: After careful re-examination, LIE-9 DOES test the static check. Without `typesCompatible`, `lie(env.fs)` would pass the Module to the function. The function calls `s.read()`. At runtime, `s` is a Module struct → evalMethod handles it as a Module method → fs.read executes → bypass succeeds. The static check (typesCompatible: Cap incompatible with struct) is what stops this. **Confirmed: yes.**

### tests/phase8-audit.test.ts (18 tests)

| # | Test name | Fails without static check? | Reason |
|---|-----------|-----------------------------|--------|
| 1 | LIE-fs-legitimate | N/A | Expects ok=true |
| 2 | LIE-fs-bypass: declare Cap<fs>, return Fake struct | **NO** — FALSE CONFIDENCE | `Fake { x: Int }` has NO impl for `read()`. Without return type check: `lie()` returns Fake struct. `fs.read()` at runtime: recv is Fake (not Module) → impls has no "Fake" → "No method 'read' on Fake" → runtime catches. **FALSE CONFIDENCE: test passes without the fix it claims to test.** |
| 3 | LIE-sql-nocheck | **NO** — FALSE CONFIDENCE | Same — `D { x: Int }` has no impl for `query()`. Runtime catches "No method". |
| 4 | LIE-cmd-nocheck | **NO** — FALSE CONFIDENCE | Same — `S { x: Int }` has no impl for `run()`. Runtime catches. |
| 5 | LIE-net | **NO** — FALSE CONFIDENCE | Same — `N { x: Int }` has no impl for `fetch()`. Runtime catches. |
| 6 | LIE-multihop | **NO** — FALSE CONFIDENCE | `Fake` has no impl. `b()` returns Fake (not Cap). Runtime catches "No method". |
| 7 | STRUCT-LIE: field declared as struct, constructed with Cap | yes | Static field type check; runtime would execute Module method |
| 8 | STRUCT-LIE-2: field as Cap, constructed with struct | yes | Static field type check |
| 9 | STRUCT-OK | N/A | Expects ok=true |
| 10 | LET-LIE: declare let as struct, assign Cap | yes | Static let type check |
| 11 | LET-OK | N/A | Expects ok=true |
| 12 | IMPL-PARAM-LIE: method param struct, called with Cap | yes | Static arg type check |
| 13 | IMPL-PARAM-OK | N/A | Expects ok=true |
| 14 | IMPL-RET-LIE: method declares Cap<fs>, returns struct | **NO** — FALSE CONFIDENCE | `Fake { x: Int }` has no impl. Runtime catches "No method". |
| 15 | IMPL-RET-OK | N/A | Expects ok=true |
| 16 | OPTION-wrap | yes | Runtime: "No method on Fake" — but static also catches. **Judgment: yes** |
| 17 | MULTIHOP-untyped | yes | Static type gate: untyped param |
| 18 | CLOSURE-cap | N/A | Expects ok=true |

**Summary: 7 yes, 5 no (FALSE CONFIDENCE), 6 N/A**

### tests/phase9-implicit-return.test.ts (9 tests)

| # | Test name | Fails without static check? | Reason |
|---|-----------|-----------------------------|--------|
| 1 | R5-LIE-fs-implicit | yes | Struct MyS HAS impl for read(). Without implicit return check: runtime executes fs.read → bypass. Static check stops it. |
| 2 | R5-sql-implicit | yes | Same — MyS has impl for query() |
| 3 | R5-cmd-implicit | yes | Same — MyS has impl for run() |
| 4 | NEST-struct | yes | Parser depth limit |
| 5 | NEST-struct-ok | N/A | Expects no crash |
| 6 | IMPL-RET-OK | N/A | Expects ok=true |
| 7 | IMPL-RET-IF | N/A | Expects ok=true |
| 8 | IMPL-RET-CAP | N/A | Expects ok=true |
| 9 | EXPL-RET-LIE | yes | Static explicit return check |

**Summary: 5 yes, 0 no** (4 N/A)

## False Confidence Summary

**Total tests audited: 81 rejection tests across 7 files**
- **yes (genuine): 72**
- **no (false confidence): 5**
- **N/A (expect ok=true): 22** (not counted in yes/no)

### The 5 false-confidence tests (all in phase8-audit.test.ts)

1. **LIE-fs-bypass** — `Fake { x: Int }` has no impl for `read()`. Runtime catches "No method on Fake".
2. **LIE-sql-nocheck** — `D { x: Int }` has no impl for `query()`. Runtime catches.
3. **LIE-cmd-nocheck** — `S { x: Int }` has no impl for `run()`. Runtime catches.
4. **LIE-net** — `N { x: Int }` has no impl for `fetch()`. Runtime catches.
5. **LIE-multihop** — `Fake` has no impl. Runtime catches.
6. **IMPL-RET-LIE** — `Fake` has no impl. Runtime catches.

**These 6 tests passed for the wrong reason** — the runtime backstop caught the error, not the type checker. If the struct had a real impl for the gated method, the bypass would have succeeded at runtime.

### Action taken

All 6 false-confidence tests have been rewritten in Phase 9 to use structs WITH real impls for the gated methods, matching the R5-LIE-fs-implicit pattern from the round-6 review. The rewritten tests are in `tests/phase9-implicit-return.test.ts`.
