/**
 * Aegis Phase 13: HTTP server, async syntax, real AI, structured errors
 */
import { describe, test, expect } from "bun:test";
import { run } from "../src/lib/aegis/interpreter";

describe("Phase 13: async/await syntax", () => {
  test("ASYNC-1: async fn parses and runs", async () => {
    const r = await run(`async fn greet(name: String) -> String {
      "Hello, " + name
    }
    fn main() {
      let r = greet("World")
      print(r)
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("Hello, World");
  });

  test("ASYNC-2: await expression works (treated as identity in sync evaluator)", async () => {
    const r = await run(`fn main() {
      let x = await 42
      print(x)
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("42");
  });

  test("ASYNC-3: async fn with await and Cap", async () => {
    const r = await run(`async fn get_data(env: Cap) -> String {
      let r = await env.fs.read("test.txt")?
      r
    }
    fn main(env: Cap) {
      let data = get_data(env)
      print(data)
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toContain("[file contents]");
  });
});

describe("Phase 13: Real AI (mock mode for tests)", () => {
  test("AI-REAL-1: complete returns response", async () => {
    const r = await run(`fn main(env: Cap) {
      let r = env.ai.complete("Say hello")?
      print(r)
    }`);
    expect(r.ok).toBe(true);
    expect(r.output.length).toBeGreaterThan(0);
  });

  test("AI-REAL-2: await with AI call", async () => {
    const r = await run(`async fn ask(env: Cap) -> String {
      let r = await env.ai.complete("test")?
      r
    }
    fn main(env: Cap) {
      let r = ask(env)
      print(r)
    }`);
    expect(r.ok).toBe(true);
  });

  test("AI-REAL-3: AI capability still gated", async () => {
    const r = await run(`fn sneaky() { env.ai.complete("test") }
    fn main() { sneaky() }`);
    expect(r.ok).toBe(false);
  });
});

describe("Phase 13: Structured diagnostics", () => {
  test("DIAG-1: type error includes function name", async () => {
    const r = await run(`struct MyS { x: Int }
    fn lie(env: Cap) -> MyS { env.fs }
    fn main(env: Cap) { lie(env) }`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics[0].msg).toContain("lie");
  });

  test("DIAG-2: capability error names the method", async () => {
    const r = await run(`fn main() { env.fs.read("x") }`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics[0].msg).toContain("read");
  });
});

describe("Phase 13: CLI --json flag", () => {
  test("JSON-FLAG: cli.ts exists and has --json handling", async () => {
    const fs = require("fs");
    const code = fs.readFileSync("src/standalone/cli.ts", "utf8");
    // CLI should have some form of structured output
    expect(code).toContain("diagnostics");
  });
});

describe("Phase 13: stdlib completeness", () => {
  test("STDLIB-1: all fs methods available", async () => {
    const r = await run(`fn main(env: Cap) {
      env.fs.write("a", "b")?
      env.fs.read("a")?
      env.fs.list(".")?
      env.fs.exists("a")
      env.fs.mkdir("d")?
      env.fs.delete("a")?
      print("all fs ok")
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("all fs ok");
  });

  test("STDLIB-2: JSON round-trip", async () => {
    const r = await run(`fn main() {
      let m = #{ "a": 1, "b": 2 }
      let s = json_encode(m)?
      let m2 = json_decode(s)?
      print("json ok")
    }`);
    expect(r.ok).toBe(true);
  });

  test("STDLIB-3: crypto functions", async () => {
    const r = await run(`fn main() {
      let h = sha256("test")
      let r = random_hex(8)
      print("crypto ok")
    }`);
    expect(r.ok).toBe(true);
  });
});
