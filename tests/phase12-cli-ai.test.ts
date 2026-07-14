/**
 * Aegis Phase 12: CLI + Cap<ai> + standalone tests
 */
import { describe, test, expect } from "bun:test";
import { run } from "../src/lib/aegis/interpreter";

describe("Phase 12: Cap<ai> capability", () => {
  test("AI-1: env.ai.complete works with Cap", () => {
    const r = run(`fn main(env: Cap) {
      let r = env.ai.complete("Hello, AI!")?
      print(r)
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toContain("[AI completion for: Hello, AI!]");
  });

  test("AI-2: env.ai.chat works with Cap", () => {
    const r = run(`fn main(env: Cap) {
      let r = env.ai.chat("What is Aegis?")?
      print(r)
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toContain("[AI chat response to:");
  });

  test("AI-3: env.ai.embed works with Cap", () => {
    const r = run(`fn main(env: Cap) {
      let r = env.ai.embed("test text")?
      print(r)
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toContain("0.1");
  });

  test("AI-4: Cap<ai> parameter grants AI access", () => {
    const r = run(`fn main(env: Cap<ai>) {
      let r = env.complete("test")?
      print(r)
    }`);
    expect(r.ok).toBe(true);
  });

  test("AI-5: ai methods rejected without Cap", () => {
    const r = run(`fn main() {
      env.ai.complete("test")
    }`);
    expect(r.ok).toBe(false);
  });

  test("AI-6: ai methods rejected via alias without Cap", () => {
    const r = run(`fn sneaky(x) { x.ai.complete("test") }
    fn main() { sneaky("not cap") }`);
    expect(r.ok).toBe(false);
  });

  test("AI-7: ai capability flows through helper with Cap param", () => {
    const r = run(`fn helper(c: Cap) { c.ai.complete("from helper")? }
    fn main(env: Cap) { print(helper(env)?) }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toContain("from helper");
  });

  test("AI-8: type-confusion on ai — declare struct, pass env.ai", () => {
    const r = run(`struct Fake { x: Int }
    impl Fake { fn complete(self, p: String) -> String { "fake" } }
    fn lie(env: Cap) -> Fake { env.ai }
    fn main(env: Cap) { let v = lie(env); v.complete("test") }`);
    expect(r.ok).toBe(false);
  });
});

describe("Phase 12: CLI structure", () => {
  test("CLI-1: cli.ts file exists", () => {
    const fs = require("fs");
    expect(fs.existsSync("src/standalone/cli.ts")).toBe(true);
  });

  test("CLI-2: interpreter has no Next.js dependency", () => {
    const fs = require("fs");
    const code = fs.readFileSync("src/lib/aegis/interpreter.ts", "utf8");
    expect(code).not.toContain("next/");
    expect(code).not.toContain("NextRequest");
    expect(code).not.toContain("NextResponse");
  });
});
