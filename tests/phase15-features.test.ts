/**
 * Aegis Phase 15: HTTP server + method chaining tests
 */
import { describe, test, expect } from "bun:test";
import { run } from "../src/lib/aegis/interpreter";

describe("Phase 15: Method chaining", () => {
  test("CHAIN-1: filter then map then join", async () => {
    const r = await run(`fn main() {
      let nums = [1, 2, 3, 4, 5, 6]
      let result = nums.filter(|x| x > 2).map(|x| x * 2).join(", ")
      print(result)
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("6, 8, 10, 12");
  });

  test("CHAIN-2: string method chaining", async () => {
    const r = await run(`fn main() {
      let s = "  hello world  "
      let result = s.trim().upper()
      print(result)
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("HELLO WORLD");
  });

  test("CHAIN-3: map with closure", async () => {
    const r = await run(`fn main() {
      let words = ["a", "b", "c"]
      let result = words.map(|w| w.upper()).join("-")
      print(result)
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("A-B-C");
  });
});

describe("Phase 15: HTTP server", () => {
  test("HTTP-1: net.serve is gated under Cap<net>", async () => {
    const r = await run(`fn main() {
      env.net.serve(3000, |req| { Ok(#{ status: 200, body: "hi" }) })
    }`);
    expect(r.ok).toBe(false);
  });

  test("HTTP-2: net.serve accepts port and handler", async () => {
    const r = await run(`fn main(env: Cap) {
      let server = env.net.serve(13098, |req| {
        Ok(#{ status: 200, body: "ok" })
      })?
      print("server started")
    }`);
    expect(r.ok).toBe(true);
    expect(r.output[0]).toBe("server started");
  });

  test("HTTP-3: server has wait and stop methods", async () => {
    const r = await run(`fn main(env: Cap) {
      let server = env.net.serve(13097, |req| {
        Ok(#{ status: 200, body: "ok" })
      })?
      server.stop()?
      print("stopped")
    }`);
    expect(r.ok).toBe(true);
  });
});
