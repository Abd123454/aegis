/**
 * Aegis Phase 10: Option/Array/Map type recursion + test isolation
 * ----------------------------------------------------------
 * These tests verify:
 *
 * Fix 1: inferType(Try) unwraps Option — `(Some(x))?` gives type of x
 * Fix 2: typeHasModuleCap recurses into option/array/map (defense-in-depth)
 * Fix 3: Test isolation — each test isolates a specific static check
 * Fix 4: New behavior tests for Option/Array/Map unwrapping
 *
 * NOTE on syntax: `Some(x)?` is parsed as `Some((x)?)` in Aegis — the ?
 * binds to the argument, not the constructor. To apply ? to a Some value,
 * use `(Some(x))?`. This is documented in the parser.
 */
import { describe, test, expect } from "bun:test";
import { run } from "../src/lib/aegis/interpreter";

// ============================================================================
// Fix 4: Option/Array/Map unwrapping behavior (F1, F2 from round 7)
// ============================================================================

describe("Phase 10: Option unwrapping (F1, F2)", () => {
  // F1: (Some(env.fs))? then .read() — should work now
  test("F1: (Some(env.fs))? then .read() works", () => {
    const r = run(`fn main(env: Cap) {
        let fs = (Some(env.fs))?
        fs.read("/etc/passwd")?
    }`);
    expect(r.ok).toBe(true);
  });

  // F2: (Some(env.fs)).unwrap_or(env.fs) then .read() — should work
  // NOTE: parentheses needed because Some(x).method() parses as Some(x.method())
  // due to operator precedence — the . binds to x before Some wraps it.
  test("F2: (Some(env.fs)).unwrap_or(env.fs) then .read() works", () => {
    const r = run(`fn main(env: Cap) {
        let fs = (Some(env.fs)).unwrap_or(env.fs)
        fs.read("/etc/passwd")?
    }`);
    expect(r.ok).toBe(true);
  });

  // Bypass check: fn lie() -> MyS { (Some(env.fs))? } — must still be rejected
  test("BYPASS-CHECK: (Some(env.fs))? as implicit return to MyS — rejected", () => {
    const r = run(`struct MyS { x: Int }
    impl MyS { fn read(self, p: String) -> String { "fake" } }
    fn lie(env: Cap) -> MyS { (Some(env.fs))? }
    fn main(env: Cap) { let v = lie(env); v.read("/etc/passwd") }`);
    expect(r.ok).toBe(false);
    // Should be rejected because (Some(env.fs))? infers as Cap<fs>, not MyS
    expect(r.diagnostics.some((d) => /implicit return|type error/i.test(d.msg))).toBe(true);
  });

  // Array indexing of Cap values
  test("ARRAY-CAP: array of Cap indexed then .read() works", () => {
    const r = run(`fn main(env: Cap) {
        let arr = [env.fs]
        let fs = arr[0]?
        fs.read("test")?
    }`);
    expect(r.ok).toBe(true);
  });

  // Map get of Cap values
  test("MAP-CAP: map with Cap value, get then .read() works", () => {
    const r = run(`fn main(env: Cap) {
        let m = #{ "fs": env.fs }
        let fs = m.get("fs")?
        fs.read("test")?
    }`);
    expect(r.ok).toBe(true);
  });
});

// ============================================================================
// Fix 3: Test isolation — each test isolates a specific static check
// ============================================================================

describe("Phase 10: Test isolation — Fix B (typesCompatible argument check)", () => {
  // This test isolates Fix B: pass env.fs to a function declaring MyStruct param.
  // No impl manipulation, no gated method call — just the type mismatch at the call site.
  // Only typesCompatible can catch this.
  test("ISOLATE-FixB: pass Cap<fs> as struct param — typesCompatible catches it", () => {
    const r = run(`struct MyS { x: Int }
    fn take(s: MyS) { s }
    fn main(env: Cap) { take(env.fs) }`);
    expect(r.ok).toBe(false);
    // The error should be about type mismatch in the call, not about gate or runtime
    expect(r.diagnostics.some((d) => /type error in call|typesCompatible/i.test(d.msg))).toBe(true);
  });
});

describe("Phase 10: Test isolation — Fix A (implMethods gate)", () => {
  // This test isolates Fix A: a struct WITHOUT impl for a gated method name.
  // The receiver type is a known user struct (no Cap), so the gate checks implMethods.
  // typesCompatible passes (no Cap involved), runtime would throw "No method".
  // But the static implMethods gate catches it first.
  test("ISOLATE-FixA: struct without impl for read() — implMethods gate catches it", () => {
    const r = run(`struct Empty { x: Int }
    fn main() {
        let e = Empty { x: 1 }
        e.read("test")
    }`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => /not defined on struct|impl/i.test(d.msg))).toBe(true);
  });
});

describe("Phase 10: Test isolation — explicit return type check", () => {
  // This test isolates the explicit return type check (Phase 8 Site 2).
  // No argument type mismatch, no implMethods issue — just returning wrong type.
  test("ISOLATE-Return: explicit return of wrong type — return check catches it", () => {
    const r = run(`struct MyS { x: Int }
    impl MyS { fn read(self, p: String) -> String { "fake" } }
    fn lie(env: Cap) -> MyS { return env.fs }
    fn main(env: Cap) { let v = lie(env); v.read("/etc/passwd") }`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => /return/i.test(d.msg))).toBe(true);
  });
});

describe("Phase 10: Test isolation — implicit return type check (Phase 9)", () => {
  // This test isolates the implicit return type check (Phase 9 Fix 1).
  // Same as explicit return but without `return` keyword.
  test("ISOLATE-ImplicitReturn: implicit return of wrong type — implicit return check catches it", () => {
    const r = run(`struct MyS { x: Int }
    impl MyS { fn read(self, p: String) -> String { "fake" } }
    fn lie(env: Cap) -> MyS { env.fs }
    fn main(env: Cap) { let v = lie(env); v.read("/etc/passwd") }`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => /implicit return/i.test(d.msg))).toBe(true);
  });
});

describe("Phase 10: Test isolation — struct field type check (Phase 8 Site 3)", () => {
  // This test isolates struct field type checking.
  // A struct declares a field of type MyS, but construction passes Cap<fs>.
  test("ISOLATE-StructField: field declared as MyS, constructed with Cap — field check catches it", () => {
    const r = run(`struct MyS { x: Int }
    struct Holder { inner: MyS }
    fn main(env: Cap) {
        let h = Holder { inner: env.fs }
    }`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => /struct construction|field/i.test(d.msg))).toBe(true);
  });
});

describe("Phase 10: Test isolation — typed let check (Phase 8 Site 4)", () => {
  // This test isolates typed let binding checking.
  test("ISOLATE-TypedLet: let x: MyS = env.fs — let type check catches it", () => {
    const r = run(`struct MyS { x: Int }
    fn main(env: Cap) {
        let x: MyS = env.fs
    }`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => /let binding/i.test(d.msg))).toBe(true);
  });
});

describe("Phase 10: Test isolation — impl method argument check (Phase 8 Site 5)", () => {
  // This test isolates impl method argument type checking.
  test("ISOLATE-ImplArg: impl method param declared as MyS, called with Cap — arg check catches it", () => {
    const r = run(`struct MyS { x: Int }
    struct Wrapper { v: Int }
    impl Wrapper {
        fn process(self, f: MyS) -> Int { self.v }
    }
    fn main(env: Cap) {
        let w = Wrapper { v: 1 }
        w.process(env.fs)
    }`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => /type error in call/i.test(d.msg))).toBe(true);
  });
});

describe("Phase 10: Legitimate use still works (no false positives)", () => {
  // Legitimate Cap<fs> return
  test("LEGIT-return: fn returns Cap<fs>, caller uses .read()", () => {
    const r = run(`fn get_fs(env: Cap) -> Cap<fs> { env.fs }
    fn main(env: Cap) { let fs = get_fs(env); fs.read("x")? }`);
    expect(r.ok).toBe(true);
  });

  // Legitimate struct with Cap field
  test("LEGIT-struct: struct with Cap field, use it", () => {
    const r = run(`struct Holder { cap: Cap }
    fn f(h: Holder) { h.cap.fs.read("x")? }
    fn main(env: Cap) { f(Holder { cap: env })? }`);
    expect(r.ok).toBe(true);
  });
});
