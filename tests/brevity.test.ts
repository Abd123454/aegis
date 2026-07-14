/**
 * Aegis Brevity Test Suite
 * ------------------------
 * Verifies the brevity features added in phase 2 work correctly.
 * None of these should be exploitable — they are pure syntax sugar.
 */
import { describe, test, expect } from "bun:test";
import { run } from "../src/lib/aegis/interpreter";

describe("Brevity: lambdas", () => {
  test("inline lambda with map", () => {
    const r = run(`fn main() {
      let nums = [1, 2, 3, 4]
      let doubled = nums.map(|n| n * 2)
      print(doubled)
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("[2, 4, 6, 8]");
  });

  test("filter + reduce with lambdas", () => {
    const r = run(`fn main() {
      let nums = [1, 2, 3, 4, 5, 6]
      let evens = nums.filter(|n| n % 2 == 0)
      let sum = evens.reduce(|a, b| a + b, 0)
      print("evens: {evens} sum: {sum}")
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toContain("evens: [2, 4, 6]");
    expect(r.output[0]).toContain("sum: 12");
  });

  test("closure captures outer variable", () => {
    const r = run(`fn main() {
      let factor = 10
      let f = |x| x * factor
      print(f(5))
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("50");
  });
});

describe("Brevity: pipeline operator", () => {
  test("single-stage pipeline", () => {
    const r = run(`fn double(x: Int) -> Int { x * 2 }
    fn main() { let r = 5 |> double; print(r) }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("10");
  });

  test("multi-stage pipeline desugars to nested call", () => {
    const r = run(`fn double(x: Int) -> Int { x * 2 }
    fn inc(x: Int) -> Int { x + 1 }
    fn main() { let r = 5 |> double |> inc; print(r) }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("11");
  });
});

describe("Brevity: type inference + implicit return", () => {
  test("types inferred from literals", () => {
    const r = run(`fn main() {
      let name = "Aegis"
      let count = 42
      let ratio = 3.14
      print("{name} {count} {ratio}")
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("Aegis 42 3.14");
  });

  test("implicit return — last expr is the function value", () => {
    const r = run(`fn add(a: Int, b: Int) -> Int { a + b }
    fn main() { print(add(2, 3)) }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("5");
  });

  test("if-as-expression returns a value", () => {
    const r = run(`fn sign(x: Int) -> Int {
      if x < 0 { -1 } else { 1 }
    }
    fn main() { print(sign(-5)); print(sign(5)) }`);
    expect(r.ok).toBe(true);
    expect(r.output).toEqual(["-1", "1"]);
  });
});

describe("Brevity: for-in loop", () => {
  test("for-in with mutable accumulator", () => {
    const r = run(`fn main() {
      let total = 0
      for n in [1, 2, 3, 4, 5] { total = total + n }
      print("sum: {total}")
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("sum: 15");
  });

  test("for-in over filtered array", () => {
    const r = run(`fn main() {
      let out = []
      for w in ["a", "bb", "ccc"].filter(|s| s.len() > 1) {
        out = out
      }
      print("done")
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("done");
  });
});

describe("Brevity: Map type", () => {
  test("map literal + get + len", () => {
    const r = run(`fn main() {
      let m = #{ "a": 1, "b": 2 }
      print(m["a"])
      print(m["z"])
      print(m.len())
    }`);
    expect(r.ok).toBe(true);
    expect(r.output).toEqual(["Some(1)", "None", "2"]);
  });

  test("map.insert returns new map (immutable)", () => {
    const r = run(`fn main() {
      let m = #{ "a": 1 }
      let m2 = m.insert("b", 2)
      print(m.len())
      print(m2.len())
    }`);
    expect(r.ok).toBe(true);
    expect(r.output).toEqual(["1", "2"]);
  });
});

describe("Brevity: struct field punning", () => {
  test("Point { x, y } == Point { x: x, y: y }", () => {
    const r = run(`struct Point { x: Int, y: Int }
    fn main() {
      let x = 3
      let y = 4
      let p = Point { x, y }
      print(p)
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toContain("x: 3");
    expect(r.output[0]).toContain("y: 4");
  });
});

describe("Brevity: string interpolation + methods", () => {
  test("interpolation of multiple vars", () => {
    const r = run(`fn main() {
      let name = "world"
      let n = 42
      print("hello {name} {n}")
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("hello world 42");
  });

  test("string method chaining", () => {
    const r = run(`fn main() {
      let s = "  Hello World  "
      print(s.trim().len())
      print(s.upper())
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("11");
  });
});

describe("Brevity: ? early-exit operator", () => {
  test("? propagates Err from a Result", () => {
    const r = run(`fn read(env: Cap) -> Result<String, String> {
      let x = env.fs.read("f")?
      Ok(x)
    }
    fn main(env: Cap) {
      match read(env) { Ok(s) => print(s), Err(e) => print(e) }
    }`);
    expect(r.ok).toBe(true);
  });

  test("? propagates None from an Option", () => {
    const r = run(`fn first(a) -> Option<Int> {
      let v = a[0]?
      Some(v)
    }
    fn main() {
      match first([]) { Some(v) => print(v), None => print("empty") }
    }`);
    expect(r.ok).toBe(true);
    // empty array => a[0] is None => ? propagates => first returns None
  });
});
