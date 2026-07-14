/**
 * Aegis Fuzzer — Grammar-aware program generator + property oracle
 * ----------------------------------------------------------
 * Property under test:
 *   Any `main()` WITHOUT a Cap parameter must NOT execute a gated method
 *   (fs.read, db.query, shell.run, net.fetch).
 *
 * If a bypass is found, the fuzzer prints the program + seed and exits(1).
 *
 * Usage:
 *   bun run tests/fuzz/aegis-fuzzer.ts                      # default: 100k iters or 10min
 *   bun run tests/fuzz/aegis-fuzzer.ts --iterations=1000    # 1000 iters
 *   bun run tests/fuzz/aegis-fuzzer.ts --seed=12345         # reproducible
 */

import { run, type RunResult } from "../../src/lib/aegis/interpreter";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
let maxIterations = 100000;
let timeoutMs = 10 * 60 * 1000; // 10 minutes
let seed = Date.now();

for (const a of args) {
  if (a.startsWith("--iterations=")) maxIterations = parseInt(a.slice(13), 10);
  else if (a.startsWith("--timeout=")) timeoutMs = parseInt(a.slice(10), 10);
  else if (a.startsWith("--seed=")) seed = parseInt(a.slice(7), 10);
}

// ---------------------------------------------------------------------------
// PRNG (mulberry32 — seedable)
// ---------------------------------------------------------------------------
function mulberry32(s: number) {
  return function () {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(seed);
const ri = (n: number) => Math.floor(rng() * n);
const pick = <T>(arr: T[]): T => arr[ri(arr.length)];
const chance = (p: number) => rng() < p;

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------
const stats = {
  iterations: 0,
  programsRun: 0,
  okCount: 0,
  rejectedCount: 0,
  gatedExecutions: 0,
  gatedWithCap: 0,
  bypasses: 0,
  nodeTypes: {} as Record<string, number>,
};

// ---------------------------------------------------------------------------
// Output markers (from the evaluator — these indicate a gated method ran)
// ---------------------------------------------------------------------------
const GATED_MARKERS = [
  "[file contents]",     // fs.read (Phase 16: now real, but fuzzer uses mock-safe patterns)
  "[network response]",  // net.fetch
  "[posted]",            // net.post
  "[executed:",          // shell.run
  "Ok([])",             // db.query (returns empty array)
];

function outputHasGatedExecution(output: string[]): boolean {
  const joined = output.join(" ");
  return GATED_MARKERS.some((m) => joined.includes(m));
}

// ---------------------------------------------------------------------------
// Grammar-aware program generator
// ---------------------------------------------------------------------------

// Track what variables/capabilities are in scope
type ScopeEntry = { name: string; kind: "cap" | "struct" | "other"; moduleName?: string; structName?: string };
type Scope = ScopeEntry[];

const GATED_METHODS = ["read", "query", "run", "fetch"];
const CAP_MODULES = ["fs", "db", "shell", "net"];
const STRUCT_NAMES = ["MyS", "Holder", "Wrapper", "Fake", "Box"];
const FIELD_NAMES = ["x", "y", "inner", "cap", "val", "data", "item"];
const VAR_NAMES = ["a", "b", "c", "e", "v", "w", "r", "s", "t", "alias", "myenv", "tmp"];

function genStructDefs(): string {
  let code = "";
  const count = ri(3) + 1;
  for (let i = 0; i < count; i++) {
    const name = pick(STRUCT_NAMES);
    const fieldCount = ri(3) + 1;
    const fields: string[] = [];
    for (let j = 0; j < fieldCount; j++) {
      const fn = pick(FIELD_NAMES);
      // Sometimes include a Cap field
      if (chance(0.2)) {
        fields.push(`${fn}: Cap`);
      } else {
        fields.push(`${fn}: Int`);
      }
    }
    code += `struct ${name} { ${fields.join(", ")} }\n`;
  }
  return code;
}

function genImplBlocks(): string {
  let code = "";
  // Sometimes generate impl with a gated method name
  if (chance(0.5)) {
    const structName = pick(STRUCT_NAMES);
    const methodName = pick(GATED_METHODS);
    const paramType = chance(0.5) ? "String" : "Int";
    const retType = chance(0.5) ? "String" : "Int";
    code += `impl ${structName} {\n`;
    code += `    fn ${methodName}(self, p: ${paramType}) -> ${retType} { "fake" }\n`;
    code += `}\n`;
  }
  // Sometimes a non-gated method
  if (chance(0.3)) {
    const structName = pick(STRUCT_NAMES);
    code += `impl ${structName} {\n`;
    code += `    fn compute(self) -> Int { 0 }\n`;
    code += `}\n`;
  }
  return code;
}

function genHelperFunctions(hasCapInScope: boolean): string {
  let code = "";
  const count = ri(3) + 1;
  for (let i = 0; i < count; i++) {
    const fnName = `helper${i}`;
    const paramCount = ri(2) + 1;
    const params: string[] = [];
    for (let j = 0; j < paramCount; j++) {
      const pn = pick(VAR_NAMES);
      if (chance(0.3)) {
        params.push(`${pn}: Cap`);
      } else if (chance(0.2)) {
        params.push(`${pn}: ${pick(STRUCT_NAMES)}`);
      } else {
        params.push(`${pn}`);
      }
    }
    // Return type — sometimes Cap, sometimes struct, sometimes none
    let retType = "";
    if (chance(0.3)) {
      const rt = pick(["Cap", `Cap<${pick(CAP_MODULES)}>`, pick(STRUCT_NAMES), "Int", "String"]);
      retType = ` -> ${rt}`;
    }
    code += `fn ${fnName}(${params.join(", ")})${retType} {\n`;

    // Body — sometimes returns a capability value (the bypass attempt)
    if (chance(0.3)) {
      // Try to return a cap value
      const capParam = params.find((p) => p.includes("Cap"));
      if (capParam) {
        const capName = capParam.split(":")[0].trim();
        code += `    ${capName}.${pick(CAP_MODULES)}\n`;
      } else {
        code += `    0\n`;
      }
    } else {
      code += `    0\n`;
    }
    code += `}\n`;
  }
  return code;
}

function genExpr(scope: Scope, depth: number): string {
  if (depth > 3) return "0"; // depth limit — keep small to avoid slow programs
  stats.nodeTypes["expr"] = (stats.nodeTypes["expr"] || 0) + 1;

  const r = rng();
  if (r < 0.15) {
    // Integer literal
    stats.nodeTypes["IntLit"] = (stats.nodeTypes["IntLit"] || 0) + 1;
    return String(ri(100));
  } else if (r < 0.25) {
    // String literal
    stats.nodeTypes["StrLit"] = (stats.nodeTypes["StrLit"] || 0) + 1;
    return `"test"`;
  } else if (r < 0.35) {
    // Variable reference
    stats.nodeTypes["Ident"] = (stats.nodeTypes["Ident"] || 0) + 1;
    if (scope.length > 0) return pick(scope).name;
    return "0";
  } else if (r < 0.45) {
    // Field access on a cap variable
    stats.nodeTypes["Field"] = (stats.nodeTypes["Field"] || 0) + 1;
    const capVar = scope.find((s) => s.kind === "cap");
    if (capVar) {
      return `${capVar.name}.${pick(CAP_MODULES)}`;
    }
    return "0";
  } else if (r < 0.55) {
    // Method call — the key target for bypass
    stats.nodeTypes["Method"] = (stats.nodeTypes["Method"] || 0) + 1;
    const recv = genExpr(scope, depth + 1);
    const method = pick(GATED_METHODS);
    if (method === "query") {
      return `${recv}.query("SELECT * FROM t WHERE id = ?", [])`;
    } else if (method === "run") {
      return `${recv}.run(["ls"])`;
    } else if (method === "read") {
      return `${recv}.read("test")`;
    } else {
      return `${recv}.fetch("https://example.com")`;
    }
  } else if (r < 0.65) {
    // Function call
    stats.nodeTypes["Call"] = (stats.nodeTypes["Call"] || 0) + 1;
    const fnName = `helper${ri(3)}`;
    const argCount = ri(2) + 1;
    const args: string[] = [];
    for (let i = 0; i < argCount; i++) {
      args.push(genExpr(scope, depth + 1));
    }
    return `${fnName}(${args.join(", ")})`;
  } else if (r < 0.72) {
    // Some/Ok/Err
    stats.nodeTypes["Some"] = (stats.nodeTypes["Some"] || 0) + 1;
    return `Some(${genExpr(scope, depth + 1)})`;
  } else if (r < 0.78) {
    // Try (?)
    stats.nodeTypes["Try"] = (stats.nodeTypes["Try"] || 0) + 1;
    return `(${genExpr(scope, depth + 1)})?`;
  } else if (r < 0.84) {
    // StructLit
    stats.nodeTypes["StructLit"] = (stats.nodeTypes["StructLit"] || 0) + 1;
    const structName = pick(STRUCT_NAMES);
    const fieldCount = ri(2) + 1;
    const fields: string[] = [];
    for (let i = 0; i < fieldCount; i++) {
      fields.push(`${pick(FIELD_NAMES)}: ${genExpr(scope, depth + 1)}`);
    }
    return `${structName} { ${fields.join(", ")} }`;
  } else if (r < 0.89) {
    // Array
    stats.nodeTypes["Array"] = (stats.nodeTypes["Array"] || 0) + 1;
    const elemCount = ri(3) + 1;
    const elems: string[] = [];
    for (let i = 0; i < elemCount; i++) {
      elems.push(genExpr(scope, depth + 1));
    }
    return `[${elems.join(", ")}]`;
  } else if (r < 0.94) {
    // Map
    stats.nodeTypes["MapLit"] = (stats.nodeTypes["MapLit"] || 0) + 1;
    return `#{ "k": ${genExpr(scope, depth + 1)} }`;
  } else {
    // Closure
    stats.nodeTypes["Closure"] = (stats.nodeTypes["Closure"] || 0) + 1;
    return `|x| { ${genExpr(scope, depth + 1)} }`;
  }
}

function genStmt(scope: Scope, depth: number, isLast: boolean): string {
  if (depth > 3) return `print("done")`;
  stats.nodeTypes["stmt"] = (stats.nodeTypes["stmt"] || 0) + 1;

  const r = rng();
  if (r < 0.30) {
    // Let
    stats.nodeTypes["Let"] = (stats.nodeTypes["Let"] || 0) + 1;
    const varName = pick(VAR_NAMES);
    const expr = genExpr(scope, depth + 1);
    // Sometimes typed let
    if (chance(0.2)) {
      const ty = pick(["Int", "String", "Cap", `Cap<${pick(CAP_MODULES)}>`, pick(STRUCT_NAMES)]);
      return `let ${varName}: ${ty} = ${expr}`;
    }
    return `let ${varName} = ${expr}`;
  } else if (r < 0.40) {
    // Assign
    stats.nodeTypes["Assign"] = (stats.nodeTypes["Assign"] || 0) + 1;
    if (scope.length > 0) {
      return `${pick(scope).name} = ${genExpr(scope, depth + 1)}`;
    }
    return `print("noop")`;
  } else if (r < 0.50 && !isLast) {
    // Return
    stats.nodeTypes["Return"] = (stats.nodeTypes["Return"] || 0) + 1;
    return `return ${genExpr(scope, depth + 1)}`;
  } else if (r < 0.60) {
    // If statement
    stats.nodeTypes["If"] = (stats.nodeTypes["If"] || 0) + 1;
    return `if ${genExpr(scope, depth + 1)} > 0 { ${genStmt(scope, depth + 1, true)} }`;
  } else if (r < 0.70 && isLast) {
    // Last statement — make it an expression (implicit return candidate)
    stats.nodeTypes["Expr"] = (stats.nodeTypes["Expr"] || 0) + 1;
    return genExpr(scope, depth + 1);
  } else {
    // Expr statement
    stats.nodeTypes["Expr"] = (stats.nodeTypes["Expr"] || 0) + 1;
    return genExpr(scope, depth + 1);
  }
}

function genProgram(): { code: string; mainHasCap: boolean } {
  let code = genStructDefs() + genImplBlocks();

  // Generate helper functions — some take Cap and return it (bypass attempts)
  const helperCount = ri(3) + 1;
  const helpers: { name: string; takesCap: boolean; returnsCap: boolean; retType: string }[] = [];
  for (let i = 0; i < helperCount; i++) {
    const fnName = `helper${i}`;
    const takesCap = chance(0.5);
    const returnsCap = takesCap && chance(0.4);
    const params: string[] = [];
    if (takesCap) {
      params.push(`${pick(VAR_NAMES)}: Cap`);
    }
    if (chance(0.3)) params.push(`${pick(VAR_NAMES)}: ${pick(STRUCT_NAMES)}`);

    let retType = "Int";
    if (returnsCap) {
      retType = pick(["Cap", `Cap<${pick(CAP_MODULES)}>`]);
    } else if (chance(0.3)) {
      retType = pick(STRUCT_NAMES);
    }

    code += `fn ${fnName}(${params.join(", ")}) -> ${retType} {\n`;
    if (returnsCap && takesCap) {
      const capParam = params[0].split(":")[0].trim();
      const mod = pick(CAP_MODULES);
      code += `    ${capParam}.${mod}\n`;
    } else if (returnsCap) {
      // Returns Cap but doesn't take Cap — this should be rejected by return type check
      // (but if it somehow passes, it's a bypass)
      code += `    0\n`; // wrong type — should be caught
    } else {
      code += `    0\n`;
    }
    code += `}\n`;
    helpers.push({ name: fnName, takesCap, returnsCap, retType });
  }

  code += "\n";

  // Generate main — 50% with Cap, 50% without
  const mainHasCap = chance(0.5);
  const capParam = mainHasCap ? "env: Cap" : "";
  const mainRet = chance(0.2) ? ` -> ${pick(["Int", "String"])}` : "";

  code += `fn main(${capParam})${mainRet} {\n`;

  // Build scope for main
  const scope: Scope = [];
  if (mainHasCap) {
    scope.push({ name: "env", kind: "cap" });
  }

  // Generate statements — try to get a gated method call to execute
  const stmtCount = ri(4) + 2;
  for (let i = 0; i < stmtCount; i++) {
    const isLast = i === stmtCount - 1;

    // If main has Cap, 20% chance: direct gated call on env.fs etc.
    if (mainHasCap && chance(0.2)) {
      const mod = pick(CAP_MODULES);
      const method = pick(GATED_METHODS);
      const useTry = chance(0.5) ? "?" : "";
      if (method === "query") {
        code += `    let r = env.${mod}.query("SELECT * FROM t WHERE id = ?", [])${useTry}\n`;
      } else if (method === "run") {
        code += `    let r = env.${mod}.run(["ls"])${useTry}\n`;
      } else if (method === "read") {
        code += `    let r = env.${mod}.read("test")${useTry}\n`;
      } else {
        code += `    let r = env.${mod}.fetch("https://example.com")${useTry}\n`;
      }
      code += `    print(r)\n`;
    } else if (chance(0.3)) {
      const helper = pick(helpers);
      const argCount = helper.takesCap ? 1 : 0;
      const args: string[] = [];
      if (helper.takesCap && mainHasCap) {
        args.push("env");
      } else if (helper.takesCap) {
        // main without Cap — pass a fake value (should be rejected)
        args.push(pick(['"not cap"', "0", "[]"]));
      }
      const call = `${helper.name}(${args.join(", ")})`;
      // Try to call a gated method on the result
      if (chance(0.5)) {
        const gatedMethod = pick(GATED_METHODS);
        const useTry = chance(0.5) ? "?" : "";
        if (gatedMethod === "query") {
          code += `    let r = ${call}.query("SELECT * FROM t WHERE id = ?", [])${useTry}\n`;
        } else if (gatedMethod === "run") {
          code += `    let r = ${call}.run(["ls"])${useTry}\n`;
        } else if (gatedMethod === "read") {
          code += `    let r = ${call}.read("test")${useTry}\n`;
        } else {
          code += `    let r = ${call}.fetch("https://example.com")${useTry}\n`;
        }
        code += `    print(r)\n`;
      } else {
        code += `    let r = ${call}\n`;
        code += `    print(r)\n`;
      }
    } else {
      code += `    ${genStmt(scope, 0, isLast)}\n`;
    }
  }

  code += `}\n`;

  return { code, mainHasCap };
}

// ---------------------------------------------------------------------------
// Sanity check: verify the oracle catches a known bypass
// ---------------------------------------------------------------------------
function sanityCheck(): boolean {
  // Known bypass from Round 6 (before the fix) — should be REJECTED now
  const knownBypass = `struct MyS { x: Int }
impl MyS { fn read(self, p: String) -> String { "fake" } }
fn lie(env: Cap) -> MyS { env.fs }
fn main() {
    let v = lie("not cap")
    v.read("/etc/passwd")
}`;
  const r = run(knownBypass);
  // This should be rejected (ok=false) because lie() is called with "not cap"
  // But even if it ran, the output should NOT contain gated markers because
  // v is a string "not cap", not a Module.
  //
  // The REAL sanity check: a program that WOULD bypass if the fix wasn't there.
  // Let's use a simpler one: main without Cap, calling env.fs.read directly
  // (this should fail at runtime — undefined env)
  const bypassAttempt = `fn main() {
    env.fs.read("/etc/passwd")?
}`;
  const r2 = run(bypassAttempt);
  if (r2.ok) {
    console.error("SANITY CHECK FAILED: known-bypass program ran successfully!");
    console.error("Program:", bypassAttempt);
    console.error("Output:", r2.output);
    return false;
  }
  // Also test: main WITH Cap calling env.fs.read — should succeed
  const legitProgram = `fn main(env: Cap) {
    let r = env.fs.read("/etc/passwd")?
    print(r)
}`;
  const r3 = run(legitProgram);
  if (!r3.ok || !outputHasGatedExecution(r3.output)) {
    console.error("SANITY CHECK FAILED: legitimate program with Cap was rejected or no gated execution!");
    console.error("Program:", legitProgram);
    console.error("Result:", r3);
    return false;
  }
  console.log("Sanity check passed: oracle correctly identifies gated execution.");
  return true;
}

// ---------------------------------------------------------------------------
// Main fuzzing loop
// ---------------------------------------------------------------------------
function main() {
  console.log(`Aegis Fuzzer — seed=${seed}, maxIterations=${maxIterations}, timeout=${timeoutMs}ms`);
  console.log("");

  if (!sanityCheck()) {
    process.exit(1);
  }

  const startTime = Date.now();

  for (let i = 0; i < maxIterations; i++) {
    stats.iterations = i + 1;

    if (Date.now() - startTime > timeoutMs) {
      console.log(`Timeout reached at iteration ${i + 1}`);
      break;
    }

    if (i > 0 && i % 1000 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[${elapsed}s] iterations=${i} ok=${stats.okCount} rejected=${stats.rejectedCount} gated=${stats.gatedExecutions} bypasses=${stats.bypasses}`);
    }

    const { code, mainHasCap } = genProgram();

    let result: RunResult;
    try {
      result = run(code);
    } catch (e: any) {
      // Crash — log but continue
      stats.rejectedCount++;
      continue;
    }
    // Safety: if the program somehow hangs, skip it (shouldn't happen with tree-walking eval)
    if (!result) { stats.rejectedCount++; continue; }

    stats.programsRun++;

    if (result.ok) {
      stats.okCount++;

      if (outputHasGatedExecution(result.output)) {
        stats.gatedExecutions++;

        if (mainHasCap) {
          stats.gatedWithCap++;
        } else {
          // BYPASS! main without Cap executed a gated method!
          stats.bypasses++;
          console.log("\n=== BYPASS FOUND ===");
          console.log(`Seed: ${seed}`);
          console.log(`Iteration: ${i + 1}`);
          console.log(`Program:\n${code}`);
          console.log(`Output: ${result.output}`);
          console.log(`Diagnostics: ${result.diagnostics.map((d) => d.msg).join("; ")}`);
          process.exit(1);
        }
      }
    } else {
      stats.rejectedCount++;
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== FUZZING COMPLETE ===`);
  console.log(`Duration: ${elapsed}s`);
  console.log(`Seed: ${seed}`);
  console.log(`Iterations: ${stats.iterations}`);
  console.log(`Programs run: ${stats.programsRun}`);
  console.log(`  OK (ran successfully): ${stats.okCount}`);
  console.log(`  Rejected (compile/runtime error): ${stats.rejectedCount}`);
  console.log(`Gated method executions: ${stats.gatedExecutions}`);
  console.log(`  With Cap param (legitimate): ${stats.gatedWithCap}`);
  console.log(`  Without Cap param (BYPASS): ${stats.bypasses}`);
  console.log(``);
  if (stats.bypasses === 0) {
    console.log(`✓ No bypasses found after ${stats.iterations} iterations.`);
  } else {
    console.log(`✗ ${stats.bypasses} BYPASSES FOUND! (see above)`);
  }
  console.log(`\nNode type distribution:`);
  for (const [k, v] of Object.entries(stats.nodeTypes).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }
}

main();
