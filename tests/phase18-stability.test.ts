/**
 * Aegis Phase 18: Bug fixes + stdlib + stability
 */
import { describe, test, expect } from "bun:test";
import { run } from "../src/lib/aegis/interpreter";

describe("Phase 18: ! operator", () => {
  test("NOT-1: !false is true", async () => {
    const r = await run(`fn main() { if !false { print("yes") } }`);
    expect(r.ok).toBe(true);
    expect(r.output).toEqual(["yes"]);
  });
  test("NOT-2: !true is false", async () => {
    const r = await run(`fn main() { if !true { print("no") } else { print("correct") } }`);
    expect(r.ok).toBe(true);
    expect(r.output).toEqual(["correct"]);
  });
  test("NOT-3: != still works", async () => {
    const r = await run(`fn main() { let x = 5; if x != 10 { print("not 10") } }`);
    expect(r.ok).toBe(true);
    expect(r.output).toEqual(["not 10"]);
  });
  test("NOT-4: !(expr)", async () => {
    const r = await run(`fn main() { if !(1 > 2) { print("correct") } }`);
    expect(r.ok).toBe(true);
    expect(r.output).toEqual(["correct"]);
  });
});

describe("Phase 18: array.push", () => {
  test("PUSH-1: push mutates array", async () => {
    const r = await run(`fn main() {
      let mut arr = [1, 2, 3]
      arr.push(4)
      arr.push(5)
      print(arr)
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("[1, 2, 3, 4, 5]");
  });
  test("PUSH-2: push returns unit", async () => {
    const r = await run(`fn main() {
      let mut arr = [1]
      let result = arr.push(2)
      print(result)
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("()");
  });
});

describe("Phase 18: array + array", () => {
  test("CONCAT-1: basic concat", async () => {
    const r = await run(`fn main() { print([1, 2] + [3, 4]) }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("[1, 2, 3, 4]");
  });
  test("CONCAT-2: multiple concats", async () => {
    const r = await run(`fn main() { print([1] + [2] + [3]) }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("[1, 2, 3]");
  });
  test("CONCAT-3: empty + non-empty", async () => {
    const r = await run(`fn main() { print([] + [1, 2]) }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("[1, 2]");
  });
});

describe("Phase 18: New string methods", () => {
  test("STR-1: starts_with", async () => {
    const r = await run(`fn main() { print("hello world".starts_with("hello")) }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("true");
  });
  test("STR-2: ends_with", async () => {
    const r = await run(`fn main() { print("hello.txt".ends_with(".txt")) }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("true");
  });
  test("STR-3: replace", async () => {
    const r = await run(`fn main() { print("hello world".replace("world", "aegis")) }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("hello aegis");
  });
  test("STR-4: repeat", async () => {
    const r = await run(`fn main() { print("ab".repeat(3)) }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("ababab");
  });
  test("STR-5: chars", async () => {
    const r = await run(`fn main() { print("abc".chars()) }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("[a, b, c]");
  });
});

describe("Phase 18: New array methods", () => {
  test("ARR-1: reverse", async () => {
    const r = await run(`fn main() { print([1, 2, 3].reverse()) }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("[3, 2, 1]");
  });
  test("ARR-2: contains", async () => {
    const r = await run(`fn main() { print([1, 2, 3].contains(2)) }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("true");
  });
  test("ARR-3: contains not found", async () => {
    const r = await run(`fn main() { print([1, 2, 3].contains(99)) }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("false");
  });
});

describe("Phase 18: Map methods", () => {
  test("MAP-1: has", async () => {
    const r = await run(`fn main() {
      let m = #{ "a": 1, "b": 2 }
      print(m.has("a"))
      print(m.has("z"))
    }`);
    expect(r.ok).toBe(true);
    expect(r.output).toEqual(["true", "false"]);
  });
  test("MAP-2: delete", async () => {
    const r = await run(`fn main() {
      let mut m = #{ "a": 1, "b": 2 }
      m = m.delete("a")
      print(m.has("a"))
      print(m.len())
    }`);
    expect(r.ok).toBe(true);
    expect(r.output).toEqual(["false", "1"]);
  });
});

describe("Phase 18: sleep", () => {
  test("SLEEP-1: sleep returns unit", async () => {
    const r = await run(`fn main() { sleep(10); print("done") }`);
    expect(r.ok).toBe(true);
    expect(r.output).toEqual(["done"]);
  });
});

describe("Phase 18: Number methods", () => {
  test("NUM-1: round", async () => {
    const r = await run(`fn main() { print(3.7.round()) }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("4");
  });
  test("NUM-2: to_string", async () => {
    const r = await run(`fn main() { print(42.to_string()) }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("42");
  });
});
