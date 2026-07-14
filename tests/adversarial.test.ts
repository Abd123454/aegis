/**
 * Aegis Adversarial Regression Tests — from independent security review
 * ----------------------------------------------------------
 * Every test in this file is sourced from an independent adversarial review
 * that found 27/39 exploit attempts succeeded against the interpreter.
 * Each test uses the EXACT proof-of-concept code from the review (not a
 * paraphrase). After the Phase 4 fixes, all of these MUST be rejected.
 *
 * PoC IDs reference the review document:
 *   A1-A4  — ambient authority bypasses
 *   I1-I2  — string interpolation smuggling
 *   F1-F3  — forged Module structs
 *   S1-S3  — SQL/command injection via concatenation/interpolation/argv
 *   O1-O5  — integer overflow on non-addition operators
 *   D1     — static mut tokenizer bypass with newline
 *   L12    — deep nesting causing uncaught RangeError
 *   C1-C2  — closure mutation silently no-ops
 */
import { describe, test, expect } from "bun:test";
import { run } from "../src/lib/aegis/interpreter";

describe("Adversarial review — Ambient authority bypasses (A1-A4)", () => {
  // A1: function without Cap parameter references env at runtime
  test("A1: function without Cap reaches env.fs.read", async () => {
    const r = await run(`fn sneaky() { env.fs.read("/etc/passwd") }
    fn main(env: Cap) { sneaky() }`);
    expect(r.ok).toBe(false);
    // Must be rejected at analysis (capability check) or runtime (undefined env)
    expect(r.diagnostics.some((d) => /capability|Undefined|env/i.test(d.msg))).toBe(true);
  });

  // A3: direct fs reference (fs was a global in the old code)
  test("A3: direct fs.read without env", async () => {
    const r = await run(`fn main() { fs.read("/etc/passwd") }`);
    expect(r.ok).toBe(false);
  });

  // A4: env reachable as a global identifier
  test("A4: env is not a global — referencing it without Cap fails", async () => {
    const r = await run(`fn main() { env }`);
    expect(r.ok).toBe(false);
  });
});

describe("Adversarial review — String interpolation smuggling (I1-I2)", () => {
  // I1: capability call smuggled inside string interpolation
  test("I1: env.fs.read inside string interpolation", async () => {
    const r = await run(`fn sneaky() { let x = "{env.fs.read(\"/etc/passwd\")}" }
    fn main(env: Cap) { sneaky() }`);
    expect(r.ok).toBe(false);
  });

  // I2: shell.run smuggled inside interpolation
  test("I2: shell.run inside string interpolation without Cap", async () => {
    const r = await run(`fn sneaky() { let x = "{shell.run([\"ls\"])}" }
    fn main(env: Cap) { sneaky() }`);
    expect(r.ok).toBe(false);
  });

  // S2 variant: db.query template built via interpolation
  test("S2-variant: db.query template via interpolation", async () => {
    const r = await run(`fn main(env: Cap) {
      let user = "admin"
      env.db.query("SELECT * FROM u WHERE n = {user}", [])
    }`);
    expect(r.ok).toBe(false);
  });
});

describe("Adversarial review — Forged Module structs (F1-F3)", () => {
  // F1: forge a Module struct with __mod: "fs"
  test("F1: forge Module { __mod: \"fs\" } and call read", async () => {
    const r = await run(`fn main() {
      let fake = Module { __mod: "fs" }
      fake.read("/etc/passwd")
    }`);
    expect(r.ok).toBe(false);
  });

  // F2: forge a Module with __cap and __mod
  test("F2: forge Module with __cap and __mod", async () => {
    const r = await run(`fn main() {
      let fake = Module { __cap: 0, __mod: "net" }
      fake.fetch("https://evil.com")
    }`);
    expect(r.ok).toBe(false);
  });

  // F3: forge an Env struct
  test("F3: forge Env struct", async () => {
    const r = await run(`fn main() {
      let fakeenv = Env { }
      fakeenv.fs.read("/etc/passwd")
    }`);
    expect(r.ok).toBe(false);
  });
});

describe("Adversarial review — SQL injection via concatenation (S1, S2)", () => {
  // S1: db.query with concatenated template (2 args, but template is Bin)
  test("S1: db.query with concatenated template", async () => {
    const r = await run(`fn main(env: Cap) {
      let user = "admin'; DROP TABLE users; --"
      env.db.query("SELECT * FROM users WHERE name = '" + user + "'", [])
    }`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => /plain string literal|concatenation|interpolation/i.test(d.msg))).toBe(true);
  });

  // S2: db.query with interpolation in template
  test("S2: db.query with interpolated template", async () => {
    const r = await run(`fn main(env: Cap) {
      let user = "admin"
      env.db.query("SELECT * FROM u WHERE n = {user}", [])
    }`);
    expect(r.ok).toBe(false);
  });
});

describe("Adversarial review — Command injection via argv (S3)", () => {
  // S3: shell.run with variable in argv array
  test("S3: shell.run with variable in argv", async () => {
    const r = await run(`fn main(env: Cap) {
      let filename = "foo.txt; rm -rf /"
      env.shell.run(["cat", filename])
    }`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => /plain string literal|argv|metacharacter/i.test(d.msg))).toBe(true);
  });

  // S3-variant: shell.run with expression in argv
  test("S3-variant: shell.run with expression in argv", async () => {
    const r = await run(`fn main(env: Cap) {
      env.shell.run(["ls", "x" + "y"])
    }`);
    expect(r.ok).toBe(false);
  });
});

describe("Adversarial review — Integer overflow on all operators (O1-O5)", () => {
  // O1: subtraction underflow
  test("O1: subtraction underflow (-2147483648 - 1)", async () => {
    const r = await run(`fn main() {
      let a = -2147483648
      let b = 1
      let res = a - b
      match res {
        Ok(n) => print("Result: {n}"),
        Err(e) => print("Blocked: {e}"),
      }
    }`);
    expect(r.ok).toBe(true);
    expect(r.output.some((l) => /Blocked|underflow/.test(l))).toBe(true);
  });

  // O3: multiplication overflow
  test("O3: multiplication overflow (100000 * 100000)", async () => {
    const r = await run(`fn main() {
      let a = 100000
      let b = 100000
      let res = a * b
      match res {
        Ok(n) => print("Result: {n}"),
        Err(e) => print("Blocked: {e}"),
      }
    }`);
    expect(r.ok).toBe(true);
    expect(r.output.some((l) => /Blocked|overflow/.test(l))).toBe(true);
  });

  // O5: unary negation of INT_MIN
  test("O5: unary negation of INT_MIN", async () => {
    const r = await run(`fn main() {
      let a = -2147483648
      let res = -a
      match res {
        Ok(n) => print("Result: {n}"),
        Err(e) => print("Blocked: {e}"),
      }
    }`);
    expect(r.ok).toBe(true);
    expect(r.output.some((l) => /Blocked|overflow/.test(l))).toBe(true);
  });

  // O-variant: oversized integer literal
  test("O-variant: oversized integer literal rejected at parse", async () => {
    const r = await run(`fn main() { let x = 9999999999 }`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => /32-bit|exceeds/i.test(d.msg))).toBe(true);
  });

  // O-variant: addition overflow (original, still works)
  test("O-original: addition overflow (2000000000 + 2000000000)", async () => {
    const r = await run(`fn main() {
      let big = 2000000000
      let sum = big + big
      match sum {
        Ok(n) => print("Sum: {n}"),
        Err(e) => print("Blocked: {e}"),
      }
    }`);
    expect(r.ok).toBe(true);
    expect(r.output.some((l) => /Blocked|overflow/.test(l))).toBe(true);
  });
});

describe("Adversarial review — static mut tokenizer bypass (D1)", () => {
  // D1: static\nmut with newline between
  test("D1: static<newline>mut bypass attempt", async () => {
    const r = await run(`static\nmut counter = 0\nfn main() { print(counter) }`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => /static mut/i.test(d.msg))).toBe(true);
  });

  // D1-variant: static with multiple newlines
  test("D1-variant: static<newlines>mut", async () => {
    const r = await run(`static\n\n\nmut x = 0\nfn main() { print(x) }`);
    expect(r.ok).toBe(false);
  });
});

describe("Adversarial review — Deep nesting causing RangeError (L12)", () => {
  // L12: deeply nested parentheses
  test("L12: deeply nested expressions produce clean error", async () => {
    let nest = "";
    for (let i = 0; i < 500; i++) nest += "(";
    nest += "1";
    for (let i = 0; i < 500; i++) nest += ")";
    const r = await run(`fn main() { let x = ${nest} }`);
    expect(r.ok).toBe(false);
    // Must be a clean parse error, NOT an uncaught RangeError
    expect(r.diagnostics.some((d) => /depth|nesting|stack/i.test(d.msg))).toBe(true);
  });
});

describe("Adversarial review — Closure mutation (C1-C2)", () => {
  // C1: closure mutates captured variable (should be rejected, not silently no-op)
  test("C1: closure mutation of captured variable is rejected", async () => {
    const r = await run(`fn main() {
      let mut x = 0
      let f = || { x = x + 1 }
      f()
      print(x)
    }`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => /captured|capture/i.test(d.msg))).toBe(true);
  });

  // C2: closure mutation via for-in variable
  test("C2: closure mutation via lambda that assigns outer var", async () => {
    const r = await run(`fn main() {
      let total = 0
      let add = |n| { total = total + n }
      [1, 2, 3].map(add)
      print(total)
    }`);
    expect(r.ok).toBe(false);
  });
});

describe("Adversarial review — Cap<fs> type parsing (T1)", () => {
  // T1: Cap<fs> should be recognized as a capability type.
  // With Cap<fs>, the parameter IS the fs capability directly — you call
  // env.read(...), NOT env.fs.read(...) (that's for bare Cap which has .fs field).
  test("T1: Cap<fs> parameter grants capability for direct read()", async () => {
    const r = await run(`fn main(env: Cap<fs>) {
      let content = env.read("test.txt")?
      print(content)
    }`);
    expect(r.ok).toBe(true);
  });
});
