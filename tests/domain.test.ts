/**
 * Aegis Domain Test Suite
 * -----------------------
 * Verifies Aegis is genuinely general-purpose, not just a "security language."
 * The word-stats example here is the fully-working reference domain program
 * referenced in the README.
 */
import { describe, test, expect } from "bun:test";
import { run } from "../src/lib/aegis/interpreter";

describe("Domain: word statistics tool (FULLY WORKING)", () => {
  const wordStatsCode = `fn main() {
    let text = "the quick brown fox the lazy dog the end"
    let words = text.split(" ").filter(|w| w.len() > 0)
    let count = words.len()
    let total_chars = words.reduce(|a, w| a + w.len(), 0)
    let avg = total_chars / count
    print("Words: {count}")
    print("Total chars: {total_chars}")
    print("Avg length: {avg}")

    let freq = #{ "the": 0 }
    for w in words {
        let cur = freq.get(w).unwrap_or(0)
        freq = freq.insert(w, cur + 1)
    }
    let the_count = freq.get("the").unwrap_or(0)
    print("the appears: {the_count} times")
}`;

  test("runs without error", async () => {
    const r = await run(wordStatsCode);
    expect(r.ok).toBe(true);
    expect(r.diagnostics.filter((d) => d.kind === "error")).toHaveLength(0);
  });

  test("correctly counts 9 words", async () => {
    const r = await run(wordStatsCode);
    expect(r.output.some((l) => l === "Words: 9")).toBe(true);
  });

  test("correctly sums character count", async () => {
    const r = await run(wordStatsCode);
    // the(3)+quick(5)+brown(5)+fox(3)+the(3)+lazy(4)+dog(3)+the(3)+end(3) = 32
    expect(r.output.some((l) => l === "Total chars: 32")).toBe(true);
  });

  test("correctly computes average", async () => {
    const r = await run(wordStatsCode);
    expect(r.output.some((l) => l === "Avg length: 3")).toBe(true);
  });

  test("correctly counts 'the' frequency", async () => {
    const r = await run(wordStatsCode);
    expect(r.output.some((l) => l === "the appears: 3 times")).toBe(true);
  });
});

describe("Domain: ETL pipeline shape", () => {
  test("ETL with fs.read + map/filter/reduce compiles and runs", async () => {
    const r = await run(`fn main(env: Cap) {
      let raw = env.fs.read("tests/fixtures/test.txt")?
      let lines = raw.split("\\n").filter(|l| l.len() > 0)
      print("lines: {lines.len()}")
    }`.replace(/\\\\n/g, "\\n"));
    expect(r.ok).toBe(true);
  });
});

describe("Domain: capability-gated server shape", () => {
  test("server skeleton uses env.net (capability explicit)", async () => {
    // Note: env.net.serve is a planned API, not yet implemented in the interpreter.
    // The test confirms the capability pattern parses; the server.run() is a stub.
    const r = await run(`fn main(env: Cap) {
      let _server = env.net.fetch("https://x.com")?
      print("ok")
    }`);
    expect(r.ok).toBe(true);
  });
});
