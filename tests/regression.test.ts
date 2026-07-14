/**
 * Aegis Regression Test Suite
 * ---------------------------
 * The 5 canonical programs from the syntax comparison section, verified to
 * keep working as the language evolves. If any of these break, a breaking
 * syntax change slipped in without a major version bump.
 */
import { describe, test, expect } from "bun:test";
import { run } from "../src/lib/aegis/interpreter";

describe("Regression: 5 canonical programs", () => {
  test("hello world", async () => {
    const r = await run(`fn main() { print("Hello, world!") }`);
    expect(r.ok).toBe(true);
    expect(r.output).toEqual(["Hello, world!"]);
  });

  test("function with error handling", async () => {
    const r = await run(`fn divide(a: Float, b: Float) -> Result<Float, String> {
      if b == 0.0 { return Err("division by zero") }
      Ok(a / b)
    }
    fn main() {
      match divide(10.0, 2.0) {
        Ok(r) => print("Result: {r}"),
        Err(e) => print("Error: {e}"),
      }
    }`);
    expect(r.ok).toBe(true);
    expect(r.output).toEqual(["Result: 5"]);
  });

  test("struct with methods", async () => {
    const r = await run(`struct Point { x: Float, y: Float }
    impl Point {
      fn new(x: Float, y: Float) -> Point { Point { x: x, y: y } }
      fn distance_to(self, other: Point) -> Float {
        let dx = self.x - other.x;
        let dy = self.y - other.y;
        (dx * dx + dy * dy).sqrt()
      }
    }
    fn main() {
      let p1 = Point::new(0.0, 0.0);
      let p2 = Point::new(3.0, 4.0);
      print("Distance: {p1.distance_to(p2)}")
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("Distance: 5");
  });

  test("read file + parse untrusted input", async () => {
    const r = await run(`fn main(env: Cap) {
      let content = env.fs.read("tests/fixtures/test.txt")?
      let n = content.parse_int()
      match n {
        Some(v) => print("Number: {v}"),
        None => print("Not a number"),
      }
    }`);
    expect(r.ok).toBe(true);
  });

  test("concurrent task with spawn(move, ...)", async () => {
    const r = await run(`fn main(env: Cap) {
      let handle = spawn(move || { env.net.fetch("https://api.example.com")? })
      match handle.join() {
        Ok(text) => print("Got: {text}"),
        Err(e) => print("Failed: {e}"),
      }
    }`);
    expect(r.ok).toBe(true);
  });
});

describe("Regression: interpreter does not crash on malformed input", () => {
  test("empty program is a no-op (no main, no error)", async () => {
    const r = await run(``);
    // An empty program has no items and no main — it does nothing.
    // This is not an error; it's a valid (if useless) program.
    expect(r.ok).toBe(true);
    expect(r.output).toEqual([]);
  });

  test("unbalanced braces", async () => {
    const r = await run(`fn main() {`);
    expect(r.ok).toBe(false);
  });

  test("undefined identifier", async () => {
    const r = await run(`fn main() { print(does_not_exist) }`);
    expect(r.ok).toBe(false);
  });

  test("type mismatch in condition", async () => {
    const r = await run(`fn main() { if 5 { print("x") } }`);
    expect(r.ok).toBe(false);
  });
});
