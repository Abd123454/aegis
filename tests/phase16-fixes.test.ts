/**
 * Aegis Phase 16: Bug fixes (&&, range, type reassign) + real I/O + path safety
 */
import { describe, test, expect } from "bun:test";
import { run } from "../src/lib/aegis/interpreter";

describe("Phase 16: && operator fix", () => {
  test("AND-1: true && true", async () => {
    const r = await run(`fn main() { if true && true { print("yes") } }`);
    expect(r.ok).toBe(true);
    expect(r.output).toEqual(["yes"]);
  });
  test("AND-2: true && false", async () => {
    const r = await run(`fn main() { if true && false { print("no") } else { print("correct") } }`);
    expect(r.ok).toBe(true);
    expect(r.output).toEqual(["correct"]);
  });
  test("AND-3: compound condition", async () => {
    const r = await run(`fn main() { let x = 5; if x > 0 && x < 10 { print("in range") } }`);
    expect(r.ok).toBe(true);
    expect(r.output).toEqual(["in range"]);
  });
  test("AND-4: || still works", async () => {
    const r = await run(`fn main() { if false || true { print("yes2") } }`);
    expect(r.ok).toBe(true);
    expect(r.output).toEqual(["yes2"]);
  });
});

describe("Phase 16: range(start, end, step)", () => {
  test("RANGE-1: range(5)", async () => {
    const r = await run(`fn main() { print(range(5)) }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("[0, 1, 2, 3, 4]");
  });
  test("RANGE-2: range(0, 5)", async () => {
    const r = await run(`fn main() { print(range(0, 5)) }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("[0, 1, 2, 3, 4]");
  });
  test("RANGE-3: range(2, 7)", async () => {
    const r = await run(`fn main() { print(range(2, 7)) }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("[2, 3, 4, 5, 6]");
  });
  test("RANGE-4: range(0, 10, 2)", async () => {
    const r = await run(`fn main() { print(range(0, 10, 2)) }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("[0, 2, 4, 6, 8]");
  });
  test("RANGE-5: range(5, 0, -1)", async () => {
    const r = await run(`fn main() { print(range(5, 0, -1)) }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("[5, 4, 3, 2, 1]");
  });
});

describe("Phase 16: Real I/O", () => {
  test("IO-1: read real file", async () => {
    const r = await run(`fn main(env: Cap) {
      let content = env.fs.read("tests/fixtures/test.txt")?
      print(content)
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toContain("test");
  });
  test("IO-2: write then read", async () => {
    const r = await run(`fn main(env: Cap) {
      env.fs.write("tests/fixtures/written.txt", "hello from aegis")?
      let content = env.fs.read("tests/fixtures/written.txt")?
      print(content)
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("hello from aegis");
  });
  test("IO-3: list directory", async () => {
    const r = await run(`fn main(env: Cap) {
      let files = env.fs.list("tests/fixtures")?
      print(files.len() > 0)
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("true");
  });
  test("IO-4: exists", async () => {
    const r = await run(`fn main(env: Cap) {
      print(env.fs.exists("tests/fixtures/test.txt"))
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("true");
  });
  test("IO-5: read nonexistent file returns Err", async () => {
    const r = await run(`fn main(env: Cap) {
      match env.fs.read("nonexistent.txt") {
        Ok(c) => print("found"),
        Err(e) => print("not found"),
      }
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toContain("not found");
  });
});

describe("Phase 16: Path safety", () => {
  test("PATH-1: ../../etc/passwd rejected", async () => {
    const r = await run(`fn main(env: Cap) {
      env.fs.read("../../etc/passwd")?
    }`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => /escapes working directory/i.test(d.msg))).toBe(true);
  });
  test("PATH-2: /etc/passwd rejected", async () => {
    const r = await run(`fn main(env: Cap) {
      env.fs.read("/etc/passwd")?
    }`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => /escapes working directory/i.test(d.msg))).toBe(true);
  });
  test("PATH-3: write outside cwd rejected", async () => {
    const r = await run(`fn main(env: Cap) {
      env.fs.write("/tmp/evil.txt", "hacked")?
    }`);
    expect(r.ok).toBe(false);
  });
});
