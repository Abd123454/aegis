/**
 * Aegis Phase 8: Comprehensive Type Annotation Audit
 * ----------------------------------------------------------
 * This test file verifies that EVERY type annotation site in the language
 * is checked by the type system, not just the two found by adversarial review.
 *
 * ANNOTATION SITE COVERAGE TABLE (Step 4 deliverable):
 *
 * | # | Site                          | Verified before Phase 8 | Verified after Phase 8 |
 * |---|-------------------------------|-------------------------|------------------------|
 * | 1 | Function parameters           | Yes (Phase 7, Fix B)    | Yes                    |
 * | 2 | Function return types         | No                      | Yes (Phase 8)          |
 * | 3 | Struct field declarations     | No                      | Yes (Phase 8)          |
 * | 4 | Typed let bindings            | No                      | Yes (Phase 8)          |
 * | 5 | Impl method parameters        | No (bodies not walked)  | Yes (Phase 8)          |
 * | 6 | Impl method return types      | No (bodies not walked)  | Yes (Phase 8)          |
 * | 7 | Closure parameters            | N/A (no type annotations)| N/A                   |
 * | 8 | Closure return types          | N/A (no type annotations)| N/A                   |
 *
 * Closures (7, 8) don't support type annotations in Aegis — they are
 * inferred-only. This is documented in the grammar.
 *
 * PoC IDs from round 5: LIE-fs, LIE-sql-nocheck, LIE-cmd-nocheck, LIE-net,
 * LIE-multihop. These test the return-type bypass (declare Cap return,
 * return a struct, use it).
 */
import { describe, test, expect } from "bun:test";
import { run } from "../src/lib/aegis/interpreter";

// ============================================================================
// ROUND 5 PoCs: Return-type bypass
// ============================================================================

describe("Phase 8: Round 5 PoCs — return-type bypass", () => {
  // LIE-fs: function declares Cap<fs> return, returns env.fs, caller uses it
  // This is the CORRECT usage — should succeed
  test("LIE-fs-legitimate: return Cap<fs> and use it", async () => {
    const r = await run(`fn get_fs(env: Cap) -> Cap<fs> { env.fs }
    fn main(env: Cap) { let fs = get_fs(env); fs.read("tests/fixtures/test.txt")? }`);
    expect(r.ok).toBe(true);
  });

  // LIE-fs-bypass: function declares Cap<fs> return but returns a struct value
  // This is the round-5 bypass — should be rejected by Phase 8 return-type check
  test("LIE-fs-bypass: declare Cap<fs> return, return struct", async () => {
    const r = await run(`struct Fake { x: Int }
    fn lie() -> Cap<fs> { Fake { x: 1 } }
    fn main() { let fs = lie(); fs.read("/etc/passwd") }`);
    expect(r.ok).toBe(false);
  });

  // LIE-sql-nocheck: declare Cap<db> return, return struct, call query
  test("LIE-sql-nocheck: declare Cap<db> return, return struct, query", async () => {
    const r = await run(`struct D { x: Int }
    fn lie() -> Cap<db> { D { x: 1 } }
    fn main() { let d = lie(); d.query("SELECT * FROM u", []) }`);
    expect(r.ok).toBe(false);
  });

  // LIE-cmd-nocheck: declare Cap<shell> return, return struct, call run
  test("LIE-cmd-nocheck: declare Cap<shell> return, return struct, run", async () => {
    const r = await run(`struct S { x: Int }
    fn lie() -> Cap<shell> { S { x: 1 } }
    fn main() { let s = lie(); s.run(["ls"]) }`);
    expect(r.ok).toBe(false);
  });

  // LIE-net: declare Cap<net> return, return struct, call fetch
  test("LIE-net: declare Cap<net> return, return struct, fetch", async () => {
    const r = await run(`struct N { x: Int }
    fn lie() -> Cap<net> { N { x: 1 } }
    fn main() { let n = lie(); n.fetch("https://evil.com") }`);
    expect(r.ok).toBe(false);
  });

  // LIE-multihop: pass through multiple functions, last one declares Cap return
  test("LIE-multihop: multi-function return-type lie", async () => {
    const r = await run(`struct Fake { x: Int }
    fn a() -> Fake { Fake { x: 1 } }
    fn b() -> Cap<fs> { a() }
    fn main() { let fs = b(); fs.read("/etc/passwd") }`);
    expect(r.ok).toBe(false);
  });
});

// ============================================================================
// NEW ADVERSARIAL TESTS: "Declare one type, provide another" at EVERY site
// ============================================================================

describe("Phase 8: Struct field type lie (Site 3)", () => {
  // Struct declares field of type MyStruct, construction provides Cap<fs>
  test("STRUCT-LIE: field declared as struct, constructed with Cap", async () => {
    const r = await run(`struct MyStruct { x: Int }
    struct Holder { inner: MyStruct }
    fn main(env: Cap) {
        let h = Holder { inner: env.fs }
        h.inner.read("/etc/passwd")
    }`);
    expect(r.ok).toBe(false);
  });

  // Struct declares Cap field, construction provides a struct — should be rejected
  test("STRUCT-LIE-2: field declared as Cap, constructed with struct", async () => {
    const r = await run(`struct Fake { x: Int }
    struct Holder { cap: Cap }
    fn main() {
        let h = Holder { cap: Fake { x: 1 } }
        h.cap.fs.read("/etc/passwd")
    }`);
    expect(r.ok).toBe(false);
  });

  // Legitimate struct field construction — should pass
  test("STRUCT-OK: field declared as Cap, constructed with env", async () => {
    const r = await run(`struct Holder { cap: Cap }
    fn main(env: Cap) {
        let h = Holder { cap: env }
        h.cap.fs.read("tests/fixtures/test.txt")?
    }`);
    expect(r.ok).toBe(true);
  });
});

describe("Phase 8: Typed let binding lie (Site 4)", () => {
  // let x: MyStruct = env.fs — type mismatch
  test("LET-LIE: declare let as struct, assign Cap", async () => {
    const r = await run(`struct MyStruct { x: Int }
    fn main(env: Cap) {
        let x: MyStruct = env.fs
        x.read("/etc/passwd")
    }`);
    expect(r.ok).toBe(false);
  });

  // Legitimate typed let — should pass
  test("LET-OK: declare let as Cap, assign env", async () => {
    const r = await run(`fn main(env: Cap) {
        let x: Cap = env
        x.fs.read("tests/fixtures/test.txt")?
    }`);
    expect(r.ok).toBe(true);
  });
});

describe("Phase 8: Impl method parameter type lie (Site 5)", () => {
  // Impl method declares struct param, called with Cap — should be rejected
  test("IMPL-PARAM-LIE: method param declared as struct, called with Cap", async () => {
    const r = await run(`struct Fake { x: Int }
    struct Wrapper { v: Int }
    impl Wrapper {
        fn process(self, f: Fake) -> Int { self.v }
    }
    fn main(env: Cap) {
        let w = Wrapper { v: 1 }
        w.process(env.fs)
    }`);
    expect(r.ok).toBe(false);
  });

  // Legitimate impl method call — should pass
  test("IMPL-PARAM-OK: method param declared as Cap, called with env", async () => {
    const r = await run(`struct Wrapper { v: Int }
    impl Wrapper {
        fn process(self, c: Cap) -> Int { self.v }
    }
    fn main(env: Cap) {
        let w = Wrapper { v: 1 }
        print(w.process(env))
    }`);
    expect(r.ok).toBe(true);
  });
});

describe("Phase 8: Impl method return type lie (Site 6)", () => {
  // Impl method declares Cap<fs> return, returns struct — should be rejected
  test("IMPL-RET-LIE: method declares Cap<fs> return, returns struct", async () => {
    const r = await run(`struct Fake { x: Int }
    struct Wrapper { v: Int }
    impl Wrapper {
        fn get_cap(self) -> Cap<fs> { Fake { x: 1 } }
    }
    fn main() {
        let w = Wrapper { v: 1 }
        let fs = w.get_cap()
        fs.read("/etc/passwd")
    }`);
    expect(r.ok).toBe(false);
  });

  // Legitimate impl method return — should pass
  test("IMPL-RET-OK: method declares Cap<fs> return, returns env.fs", async () => {
    const r = await run(`struct Wrapper { env: Cap }
    impl Wrapper {
        fn get_fs(self) -> Cap<fs> { self.env.fs }
    }
    fn main(env: Cap) {
        let w = Wrapper { env: env }
        let fs = w.get_fs()
        fs.read("tests/fixtures/test.txt")?
    }`);
    expect(r.ok).toBe(true);
  });
});

// ============================================================================
// Re-verify round-5 non-findings (should still hold)
// ============================================================================

describe("Phase 8: Re-verify round-5 non-findings", () => {
  // Option wrapping — should still be rejected
  test("OPTION-wrap: Cap in Option still rejected at unwrap", async () => {
    const r = await run(`struct Fake { x: Int }
    fn sneaky(opt) { opt?.read("/etc/passwd") }
    fn main() { sneaky(Some(Fake { x: 1 })) }`);
    expect(r.ok).toBe(false);
  });

  // Multi-hop with untyped params — should still be rejected
  test("MULTIHOP-untyped: chain of untyped params rejected", async () => {
    const r = await run(`fn a(x) { b(x) }
    fn b(x) { c(x) }
    fn c(x) { x.read("/etc/passwd") }
    fn main() { a("not a cap") }`);
    expect(r.ok).toBe(false);
  });

  // Closure capturing cap — should still work
  test("CLOSURE-cap: closure captures env, uses it", async () => {
    const r = await run(`fn main(env: Cap) {
        let f = || { env.fs.read("tests/fixtures/test.txt")? }
        f()
    }`);
    expect(r.ok).toBe(true);
  });
});
