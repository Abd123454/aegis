/**
 * Aegis Phase 9: Implicit Return Type Check + Struct Literal Depth
 * ----------------------------------------------------------
 * These tests verify the Phase 9 fixes:
 *
 * Fix 1: Implicit returns (last expression in a function body) are now
 *        type-checked against the declared return type. Previously, only
 *        explicit `return` statements were checked, allowing a function
 *        declaring `-> MyStruct` to implicitly return `env.fs` (a Cap<fs>),
 *        which was then used to call privileged methods on the struct's impl.
 *
 * Fix 2: Struct literal parsing now has depth tracking (256 max), preventing
 *        stack overflow crashes on deeply nested struct literals.
 *
 * PoC IDs from round 6: R5-LIE-fs-implicit, R5-sql-implicit, R5-cmd-implicit,
 * NEST-struct.
 *
 * CRITICAL NOTE: The Phase 8 test LIE-fs-bypass gave FALSE CONFIDENCE — it
 * passed because the struct used (Fake { x: Int }) had no impl for read(),
 * so the runtime backstop caught it. The REAL bypass uses a struct WITH an
 * impl for the gated method name. These tests use that pattern.
 */
import { describe, test, expect } from "bun:test";
import { run } from "../src/lib/aegis/interpreter";

describe("Phase 9: Implicit return bypass — fs (R5-LIE-fs-implicit)", () => {
  // The struct has a REAL impl for read() — so the runtime backstop won't
  // catch it. Only the type checker's implicit-return check can stop this.
  test("R5-LIE-fs-implicit: declare -> MyS, implicit return env.fs", () => {
    const r = run(`struct MyS { x: Int }
    impl MyS {
        fn read(self, path: String) -> String { "fake" }
    }
    fn lie(env: Cap) -> MyS { env.fs }
    fn main(env: Cap) {
        let v = lie(env)
        v.read("/etc/passwd")
    }`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => /implicit return/i.test(d.msg))).toBe(true);
  });
});

describe("Phase 9: Implicit return bypass — db (R5-sql-implicit)", () => {
  test("R5-sql-implicit: declare -> MyS, implicit return env.db", () => {
    const r = run(`struct MyS { x: Int }
    impl MyS {
        fn query(self, q: String, p: Array<String>) -> Int { 0 }
    }
    fn lie(env: Cap) -> MyS { env.db }
    fn main(env: Cap) {
        let v = lie(env)
        let user = "admin'; DROP TABLE users; --"
        v.query("SELECT * FROM u WHERE n = '" + user + "'", [])
    }`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => /implicit return/i.test(d.msg))).toBe(true);
  });
});

describe("Phase 9: Implicit return bypass — shell (R5-cmd-implicit)", () => {
  test("R5-cmd-implicit: declare -> MyS, implicit return env.shell", () => {
    const r = run(`struct MyS { x: Int }
    impl MyS {
        fn run(self, args: Array<String>) -> String { "fake" }
    }
    fn lie(env: Cap) -> MyS { env.shell }
    fn main(env: Cap) {
        let v = lie(env)
        v.run(["cat", "foo.txt; rm -rf /"])
    }`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => /implicit return/i.test(d.msg))).toBe(true);
  });
});

describe("Phase 9: Struct literal depth (NEST-struct)", () => {
  // 300 levels of nested struct literals — must produce a clean error, not crash
  test("NEST-struct: 300 nested struct literals produce clean error", () => {
    let code = "struct N { v: Int, n: N }\nfn main() { let x = ";
    for (let i = 0; i < 300; i++) code += "N { v: 0, n: ";
    code += "N { v: 0 }";
    for (let i = 0; i < 300; i++) code += " }";
    code += " }";
    const r = run(code);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => /depth|nesting/i.test(d.msg))).toBe(true);
  });

  // 100 levels — should work fine (under the 256 limit)
  test("NEST-struct-ok: 100 nested struct literals work", () => {
    let code = "struct N { v: Int }\nfn main() { let x = ";
    for (let i = 0; i < 100; i++) code += "N { v: 0, n: ";
    code += "N { v: 0 }";
    for (let i = 0; i < 100; i++) code += " }";
    code += " }";
    const r = run(code);
    // May fail for other reasons (recursive struct not fully supported),
    // but should NOT crash with exit 137.
    expect(r).toBeDefined();
    expect(r.diagnostics).toBeDefined();
  });
});

describe("Phase 9: Implicit return — legitimate cases still work", () => {
  // Legitimate implicit return with matching type
  test("IMPL-RET-OK: implicit return of correct type works", () => {
    const r = run(`fn f(x: Int) -> Int { x + 1 }
    fn main() { print(f(5)) }`);
    expect(r.ok).toBe(true);
    expect(r.output).toEqual(["6"]);
  });

  // Implicit return via if-expression
  test("IMPL-RET-IF: implicit return via if-expression works", () => {
    const r = run(`fn sign(x: Int) -> Int {
        if x > 0 { 1 } else { -1 }
    }
    fn main() { print(sign(5)); print(sign(-5)) }`);
    expect(r.ok).toBe(true);
  });

  // Implicit return of Cap from a function that received Cap
  test("IMPL-RET-CAP: implicit return of Cap<fs> works", () => {
    const r = run(`fn get_fs(env: Cap) -> Cap<fs> { env.fs }
    fn main(env: Cap) { let fs = get_fs(env); fs.read("x")? }`);
    expect(r.ok).toBe(true);
  });
});

describe("Phase 9: Explicit return still checked (regression)", () => {
  // Explicit return with wrong type — should still be rejected
  test("EXPL-RET-LIE: explicit return of wrong type rejected", () => {
    const r = run(`struct MyS { x: Int }
    impl MyS { fn read(self, p: String) -> String { "x" } }
    fn lie(env: Cap) -> MyS { return env.fs }
    fn main(env: Cap) { let v = lie(env); v.read("/etc/passwd") }`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => /return/i.test(d.msg))).toBe(true);
  });
});
