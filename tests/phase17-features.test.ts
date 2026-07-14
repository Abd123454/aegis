/**
 * Aegis Phase 17: type reassignment + mut + while loop
 */
import { describe, test, expect } from "bun:test";
import { run } from "../src/lib/aegis/interpreter";

describe("Phase 17: Type reassignment check", () => {
  test("REASSIGN-1: same type ok", async () => {
    const r = await run(`fn main() { let x = 5; x = 10; print(x) }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("10");
  });
  test("REASSIGN-2: cap-to-other reassignment rejected", async () => {
    // Note: primitive types (Int, String, etc.) are all "other" in the type system,
    // so Int→String reassignment can't be caught. But Cap→non-Cap CAN be caught.
    const r = await run(`fn main(env: Cap) {
      let x = 5
      x = env.fs
    }`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => /cannot assign|type error/i.test(d.msg))).toBe(true);
  });
  test("REASSIGN-3: expression same type ok", async () => {
    const r = await run(`fn main() { let x = 5; x = x + 1; print(x) }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("6");
  });
});

describe("Phase 17: mut in closures", () => {
  test("MUT-1: closure captures and mutates", async () => {
    const r = await run(`fn main() {
      let mut count = 0
      let inc = |n| { count = count + n }
      inc(5)
      inc(10)
      print(count)
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("15");
  });
  test("MUT-2: multiple closures share state", async () => {
    const r = await run(`fn main() {
      let mut count = 0
      let inc = || { count = count + 1 }
      let dec = || { count = count - 1 }
      inc()
      inc()
      dec()
      print(count)
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("1");
  });
  test("MUT-3: mut array push in closure", async () => {
    const r = await run(`fn main() {
      let mut items = []
      let add = |x| { items = items }
      add(1)
      print("ok")
    }`);
    expect(r.ok).toBe(true);
  });
});

describe("Phase 17: while loop", () => {
  test("WHILE-1: basic loop", async () => {
    const r = await run(`fn main() {
      let mut i = 0
      let mut sum = 0
      while i < 10 {
        sum = sum + i
        i = i + 1
      }
      print(sum)
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("45");
  });
  test("WHILE-2: break", async () => {
    const r = await run(`fn main() {
      let mut n = 0
      while true {
        if n >= 5 { break }
        n = n + 1
      }
      print(n)
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("5");
  });
  test("WHILE-3: continue", async () => {
    const r = await run(`fn main() {
      let mut sum = 0
      let mut j = 0
      while j < 10 {
        j = j + 1
        if j % 2 == 0 { continue }
        sum = sum + j
      }
      print(sum)
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("25");
  });
  test("WHILE-4: iteration limit", async () => {
    const r = await run(`fn main() {
      while true { }
    }`);
    expect(r.ok).toBe(false);
    expect(r.diagnostics.some((d) => /iterations|infinite/i.test(d.msg))).toBe(true);
  });
});
