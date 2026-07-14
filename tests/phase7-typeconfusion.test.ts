/**
 * Aegis Phase 7: Type-Confusion and Robustness Regression Tests
 * ----------------------------------------------------------
 * These tests are sourced from the FOURTH independent adversarial review.
 * The review found two unsound typing rules:
 *
 * 1. The gate allowed gated method names on any user-struct-typed receiver
 *    without verifying the struct actually defines that method (LIE-9).
 * 2. The type checker never verified call-site argument types against
 *    declared parameter types (SQL-INJECTION-FULL, CMD-INJECTION-FULL,
 *    NET-FETCH-FULL).
 *
 * Also includes carried-over robustness fixes: NEST-B (50000-addition
 * analyzer crash), CRASH-1/2/4 (null AST nodes), and integer literal
 * out-of-range handling.
 *
 * PoC IDs from the fourth review: LIE-9, BYPASS-clean, BYPASS-verify,
 * BYPASS-verify-shell, SQL-INJECTION-FULL, CMD-INJECTION-FULL,
 * NET-FETCH-FULL, NEST-B, CRASH-1, CRASH-2, CRASH-4.
 *
 * Also includes false-positive checks: LEGITIMATE user methods named
 * read/fetch/run/query on structs that actually implement them.
 */
import { describe, test, expect } from "bun:test";
import { run } from "../src/lib/aegis/interpreter";

describe("Phase 7: Type confusion — LIE-9 and variants", () => {
  // LIE-9: pass env.fs (Cap<fs>) to a function declaring a struct-typed param,
  // then call a gated method on it. The old gate saw "user struct, no cap"
  // and allowed it. Fix B (typesCompatible) should reject at the call site.
  test("LIE-9: pass Cap<fs> as struct-typed param, call read", () => {
    const r = run(`struct Fake { x: Int }
    fn lie(s: Fake) { s.read("/etc/passwd") }
    fn main(env: Cap) { lie(env.fs) }`);
    expect(r.ok).toBe(false);
    // Should be rejected by Fix B (type incompatibility) or Fix A (no impl)
    expect(r.diagnostics.some((d) => /type|not defined|capability/i.test(d.msg))).toBe(true);
  });

  // BYPASS-clean: pass env (Cap) as a struct-typed param
  test("BYPASS-clean: pass Cap as struct-typed param", () => {
    const r = run(`struct Clean { x: Int }
    fn f(c: Clean) { c.read("/etc/passwd") }
    fn main(env: Cap) { f(env) }`);
    expect(r.ok).toBe(false);
  });

  // BYPASS-verify: pass env.fs (Cap<fs>) as struct param, verify read works
  // This is the SQL injection variant — pass Cap<fs> under a struct type
  test("BYPASS-verify: pass Cap<fs> as struct, attempt read", () => {
    const r = run(`struct V { x: Int }
    fn f(v: V) { v.read("/etc/passwd") }
    fn main(env: Cap) { f(env.fs) }`);
    expect(r.ok).toBe(false);
  });

  // BYPASS-verify-shell: pass env.shell (Cap<shell>) as struct, attempt run
  test("BYPASS-verify-shell: pass Cap<shell> as struct, attempt run", () => {
    const r = run(`struct S { x: Int }
    fn f(s: S) { s.run(["ls"]) }
    fn main(env: Cap) { f(env.shell) }`);
    expect(r.ok).toBe(false);
  });

  // SQL-INJECTION-FULL: pass env.db as struct, call query with concat
  test("SQL-INJECTION-FULL: pass Cap<db> as struct, query with concat", () => {
    const r = run(`struct D { x: Int }
    fn f(d: D) { let user = "admin'; DROP TABLE users; --"; d.query("SELECT * FROM u WHERE n = '" + user + "'", []) }
    fn main(env: Cap) { f(env.db) }`);
    expect(r.ok).toBe(false);
  });

  // CMD-INJECTION-FULL: pass env.shell as struct, call run with variable
  test("CMD-INJECTION-FULL: pass Cap<shell> as struct, run with variable", () => {
    const r = run(`struct Sh { x: Int }
    fn f(s: Sh) { let fname = "x; rm -rf /"; s.run(["cat", fname]) }
    fn main(env: Cap) { f(env.shell) }`);
    expect(r.ok).toBe(false);
  });

  // NET-FETCH-FULL: pass env.net as struct, call fetch
  test("NET-FETCH-FULL: pass Cap<net> as struct, attempt fetch", () => {
    const r = run(`struct N { x: Int }
    fn f(n: N) { n.fetch("https://evil.com") }
    fn main(env: Cap) { f(env.net) }`);
    expect(r.ok).toBe(false);
  });
});

describe("Phase 7: False-positive checks — legitimate user methods", () => {
  // These MUST pass — Fix A should not break legitimate user methods
  // named read/fetch/run/query on structs that actually implement them.

  test("LEGIT-read: user struct with read() method works", () => {
    const r = run(`struct Reader { data: String }
    impl Reader {
        fn read(self) -> String { self.data }
    }
    fn main() {
        let r = Reader { data: "hello" }
        print(r.read())
    }`);
    expect(r.ok).toBe(true);
    expect(r.output).toEqual(["hello"]);
  });

  test("LEGIT-fetch: user struct with fetch() method works", () => {
    const r = run(`struct Fetcher { url: String }
    impl Fetcher {
        fn fetch(self) -> String { self.url }
    }
    fn main() {
        let f = Fetcher { url: "https://example.com" }
        print(f.fetch())
    }`);
    expect(r.ok).toBe(true);
  });

  test("LEGIT-run: user struct with run() method works", () => {
    const r = run(`struct Runner { steps: Int }
    impl Runner {
        fn run(self) -> Int { self.steps }
    }
    fn main() {
        let r = Runner { steps: 42 }
        print(r.run())
    }`);
    expect(r.ok).toBe(true);
    expect(r.output).toEqual(["42"]);
  });

  test("LEGIT-query: user struct with query() method works", () => {
    const r = run(`struct Searcher { index: Int }
    impl Searcher {
        fn query(self, q: String) -> Int { self.index }
    }
    fn main() {
        let s = Searcher { index: 42 }
        print(s.query("hello"))
    }`);
    expect(r.ok).toBe(true);
    expect(r.output).toEqual(["42"]);
  });

  // Struct that does NOT implement a gated method — should be rejected
  test("LEGIT-reject: struct without read() impl, calling read() rejected", () => {
    const r = run(`struct Empty { x: Int }
    fn main() {
        let e = Empty { x: 1 }
        e.read("test")
    }`);
    expect(r.ok).toBe(false);
  });
});

describe("Phase 7: Robustness — depth limit in walkExpr (NEST-B)", () => {
  // NEST-B: deeply nested binary chain — old analyzer crashed with RangeError.
  // Using 1000 additions (not 50000) to keep the test fast while still
  // testing the depth limit. The walkExpr depth limit (256) will trigger.
  test("NEST-B: 1000-addition chain doesn't crash type checker", () => {
    let code = "fn main() { let x = 1";
    for (let i = 0; i < 1000; i++) code += " + 1";
    code += " }";
    const r = run(code);
    // Should not crash with uncaught RangeError — either succeeds or gives
    // a clean depth error. The test verifies run() returns a result, not
    // that the process crashes.
    expect(r).toBeDefined();
    expect(r.diagnostics).toBeDefined();
  });
});

describe("Phase 7: Robustness — null AST nodes (CRASH-1/2/4)", () => {
  // CRASH-1: Cap used as a struct name in a struct literal
  test("CRASH-1: Cap { x: 1 } doesn't crash", () => {
    const r = run(`fn main() { let x = Cap { x: 1 } }`);
    // Should produce a clean error, not crash
    expect(r).toBeDefined();
    expect(r.diagnostics).toBeDefined();
  });

  // CRASH-2: malformed let with missing expression
  test("CRASH-2: let x = ; doesn't crash", () => {
    const r = run(`fn main() { let x = ; }`);
    expect(r).toBeDefined();
    expect(r.ok).toBe(false);
  });

  // CRASH-4: nested malformed expression
  test("CRASH-4: nested malformed expression doesn't crash", () => {
    const r = run(`fn main() { let x = (1 + ); }`);
    expect(r).toBeDefined();
    expect(r.ok).toBe(false);
  });
});

describe("Phase 7: Integer literal out-of-range (carried from round 2)", () => {
  // Bare positive literal above INT_MAX should be rejected at parse time
  test("LIT-1: 2147483648 (bare) rejected at parse time", () => {
    const r = run(`fn main() { let x = 2147483648 }`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => /32-bit|exceeds/i.test(d.msg))).toBe(true);
  });

  // But -2147483648 (INT_MIN) should work via the special-case
  test("LIT-2: -2147483648 (INT_MIN) works", () => {
    const r = run(`fn main() { let x = -2147483648; print(x) }`);
    expect(r.ok).toBe(true);
    expect(r.output).toEqual(["-2147483648"]);
  });

  // 2147483647 (INT_MAX) should work
  test("LIT-3: 2147483647 (INT_MAX) works", () => {
    const r = run(`fn main() { let x = 2147483647; print(x) }`);
    expect(r.ok).toBe(true);
    expect(r.output).toEqual(["2147483647"]);
  });

  // 9999999999 (way over) rejected
  test("LIT-4: 9999999999 rejected", () => {
    const r = run(`fn main() { let x = 9999999999 }`);
    expect(r.ok).toBe(false);
  });
});
