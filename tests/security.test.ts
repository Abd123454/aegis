/**
 * Aegis Security Test Suite
 * -------------------------
 * Every exploit attempt below MUST be rejected (compile or runtime).
 * These tests are the executable form of the threat table in README.md.
 * If any of these passes (i.e. the exploit runs unsafely), the language's
 * core security promise is broken and CI will fail.
 *
 * Run: `bun test`
 */
import { describe, test, expect } from "bun:test";
import { run } from "../src/lib/aegis/interpreter";

describe("Security: rejected by construction", () => {
  test("null dereference — `null` is not a token", () => {
    const r = run(`fn main() { let x = null }`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => /no `null`/.test(d.msg))).toBe(true);
  });

  test("use-after-free — `malloc`/`free` do not exist", () => {
    const r = run(`fn main() { let p = malloc(4); free(p); print(p) }`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => /malloc|free/.test(d.msg))).toBe(true);
  });

  test("double-free — same mechanism (no free at all)", () => {
    const r = run(`fn main() { free("x") }`);
    expect(r.ok).toBe(false);
  });

  test("SQL injection — db.query(string) rejected at analysis", () => {
    const r = run(`fn main(env: Cap) {
      let user = "admin'; DROP TABLE users; --"
      env.db.query("SELECT * FROM users WHERE name = '" + user + "'")
    }`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => /SQL injection|template, params/.test(d.msg))).toBe(true);
  });

  test("command injection — shell.run(string) rejected at analysis", () => {
    const r = run(`fn main(env: Cap) {
      let filename = "foo.txt; rm -rf /"
      env.shell.run("cat " + filename)
    }`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => /command injection|array/.test(d.msg))).toBe(true);
  });

  test("data race — `static mut` is forbidden", () => {
    const r = run(`static mut counter = 0\nfn main() { spawn(move || { }) }`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => /static mut/.test(d.msg))).toBe(true);
  });

  test("ambient authority — fs.read without Cap rejected at analysis", () => {
    const r = run(`fn process(input: String) { fs.read(input) }
    fn main(env: Cap) { process("/etc/passwd") }`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => /capability|Cap/.test(d.msg))).toBe(true);
  });

  test("buffer overflow — out-of-bounds index returns None, not UB", () => {
    const r = run(`fn main() {
      let buf = [1, 2, 3, 4, 5]
      match buf[100] {
        Some(v) => print("Got: {v}"),
        None => print("Out of bounds — safely returned None"),
      }
    }`);
    expect(r.ok).toBe(true);
    expect(r.output).toContain("Out of bounds — safely returned None");
  });

  test("integer overflow — checked arithmetic returns Err", () => {
    const r = run(`fn main() {
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

  test("raw pointer — `&` is not in the safe subset", () => {
    const r = run(`fn main() { let x = &5 }`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => /Raw references|&/.test(d.msg))).toBe(true);
  });

  test("spawn without `move` is rejected", () => {
    const r = run(`fn main() { spawn(|| { }) }`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => /move/.test(d.msg))).toBe(true);
  });

  test("non-exhaustive match is a runtime error (not silent fallthrough)", () => {
    // None does not match Some(n) => non-exhaustive => runtime error.
    const r = run(`fn main() {
      let x = None
      match x { Some(n) => print(n) }
    }`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => /exhaustive/i.test(d.msg))).toBe(true);
  });

  test("calling a non-function fails cleanly", () => {
    const r = run(`fn main() { let x = 5; x() }`);
    expect(r.ok).toBe(false);
  });
});

describe("Security: brevity features do NOT weaken guarantees", () => {
  test("SQL injection rejected even with brevity syntax", () => {
    const r = run(`fn main(env: Cap) {
      let u = "admin"
      env.db.query("SELECT * FROM u WHERE n='" + u + "'")
    }`);
    expect(r.ok).toBe(false);
  });

  test("command injection rejected even with brevity syntax", () => {
    const r = run(`fn main(env: Cap) { env.shell.run("ls " + "x") }`);
    expect(r.ok).toBe(false);
  });

  test("static mut rejected even in one line", () => {
    const r = run(`static mut c = 0`);
    expect(r.ok).toBe(false);
  });

  test("ambient fs.read rejected even via lambda + pipeline", () => {
    const r = run(`fn go(f) { f("/etc/passwd") }
    fn main(env: Cap) { go(|p| fs.read(p)) }`);
    expect(r.ok).toBe(false);
  });
});
