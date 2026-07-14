/**
 * Aegis Phase 12: CLI + Cap<ai> + standalone tests
 */
import { describe, test, expect } from "bun:test";
import { run } from "../src/lib/aegis/interpreter";

describe("Phase 12: Cap<ai> capability", () => {
  test("AI-1: env.ai.complete works with Cap", async () => {
    const r = await run(`fn main(env: Cap) {
      let r = env.ai.complete("Hello, AI!")?
      print(r)
    }`);
    expect(r.ok).toBe(true);
    // Accept any non-empty response (real AI or mock)
    expect(r.output.length).toBeGreaterThan(0);
    expect(r.output[0].length).toBeGreaterThan(0);
  });

  test("AI-2: env.ai.chat works with Cap", async () => {
    const r = await run(`fn main(env: Cap) {
      let r = env.ai.chat("What is Aegis?")?
      print(r)
    }`);
    expect(r.ok).toBe(true);
    expect(r.output.length).toBeGreaterThan(0);
  });

  test("AI-3: env.ai.embed works with Cap", async () => {
    const r = await run(`fn main(env: Cap) {
      let r = env.ai.embed("test text")?
      print(r)
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toContain("0.1");
  });

  test("AI-4: Cap<ai> parameter grants AI access", async () => {
    const r = await run(`fn main(env: Cap<ai>) {
      let r = env.complete("test")?
      print(r)
    }`);
    expect(r.ok).toBe(true);
  });

  test("AI-5: ai methods rejected without Cap", async () => {
    const r = await run(`fn main() {
      env.ai.complete("test")
    }`);
    expect(r.ok).toBe(false);
  });

  test("AI-6: ai methods rejected via alias without Cap", async () => {
    const r = await run(`fn sneaky(x) { x.ai.complete("test") }
    fn main() { sneaky("not cap") }`);
    expect(r.ok).toBe(false);
  });

  test("AI-7: ai capability flows through helper with Cap param", async () => {
    const r = await run(`fn helper(c: Cap) { c.ai.complete("from helper")? }
    fn main(env: Cap) { print(helper(env)?) }`);
    expect(r.ok).toBe(true);
    expect(r.output.length).toBeGreaterThan(0);
  });

  test("AI-8: type-confusion on ai — declare struct, pass env.ai", async () => {
    const r = await run(`struct Fake { x: Int }
    impl Fake { fn complete(self, p: String) -> String { "fake" } }
    fn lie(env: Cap) -> Fake { env.ai }
    fn main(env: Cap) { let v = lie(env); v.complete("test") }`);
    expect(r.ok).toBe(false);
  });
});

describe("Phase 12: CLI structure", () => {
  test("CLI-1: cli.ts file exists", async () => {
    const fs = require("fs");
    expect(fs.existsSync("src/standalone/cli.ts")).toBe(true);
  });

  test("CLI-2: interpreter has no Next.js dependency", async () => {
    const fs = require("fs");
    const code = fs.readFileSync("src/lib/aegis/interpreter.ts", "utf8");
    expect(code).not.toContain("next/");
    expect(code).not.toContain("NextRequest");
    expect(code).not.toContain("NextResponse");
  });
});

describe("Phase 12: Extended fs stdlib", () => {
  test("FS-1: fs.write works with Cap", async () => {
    const r = await run(`fn main(env: Cap) {
      env.fs.write("test.txt", "hello")?
    }`);
    expect(r.ok).toBe(true);
  });

  test("FS-2: fs.list works with Cap", async () => {
    const r = await run(`fn main(env: Cap) {
      let files = env.fs.list(".")?
      print(files)
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toContain("README"); // real files from cwd
  });

  test("FS-3: fs.exists works with Cap", async () => {
    const r = await run(`fn main(env: Cap) {
      print(env.fs.exists("test.txt"))
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("true");
  });

  test("FS-4: fs.write rejected without Cap", async () => {
    const r = await run(`fn main() {
      env.fs.write("test.txt", "hello")
    }`);
    expect(r.ok).toBe(false);
  });

  test("FS-5: fs.delete works with Cap", async () => {
    const r = await run(`fn main(env: Cap) {
      env.fs.delete("test.txt")?
    }`);
    expect(r.ok).toBe(true);
  });

  test("FS-6: fs.mkdir works with Cap", async () => {
    const r = await run(`fn main(env: Cap) {
      env.fs.mkdir("newdir")?
    }`);
    expect(r.ok).toBe(true);
  });
});

describe("Phase 12: JSON stdlib", () => {
  test("JSON-1: json_encode on map", async () => {
    const r = await run(`fn main() {
      let m = #{ "name": "Aegis", "version": 12 }
      let j = json_encode(m)?
      print(j)
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toContain("Aegis");
  });

  test("JSON-2: json_decode on string", async () => {
    // Use a simple number JSON to avoid string escaping issues in Aegis tokenizer
    const r = await run(`fn main() {
      let parsed = json_decode("42")?
      print(parsed)
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("42");
  });

  test("JSON-3: json_decode on invalid JSON returns Err", async () => {
    const r = await run(`fn main() {
      match json_decode("not json") {
        Ok(v) => print("ok"),
        Err(e) => print("error: {e}"),
      }
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toContain("error");
  });
});

describe("Phase 12: Crypto stdlib", () => {
  test("CRYPTO-1: sha256 produces hex string", async () => {
    const r = await run(`fn main() {
      let h = sha256("hello")
      print(h)
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toMatch(/^[0-9a-f]+$/);
  });

  test("CRYPTO-2: random_hex produces hex of requested length", async () => {
    const r = await run(`fn main() {
      let h = random_hex(16)
      print(h)
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toHaveLength(16);
    expect(r.output[0]).toMatch(/^[0-9a-f]+$/);
  });
});

describe("Phase 12: net.post extended", () => {
  test("NET-1: net.post works with Cap (2 args)", async () => {
    const r = await run(`fn main(env: Cap) {
      let r = env.net.post("https://api.example.com", "body data")?
      print(r)
    }`);
    expect(r.ok).toBe(true);
  });

  test("NET-2: net.post rejected without Cap", async () => {
    const r = await run(`fn main() {
      env.net.post("https://x.com", "data")
    }`);
    expect(r.ok).toBe(false);
  });
});
