#!/usr/bin/env bun
/**
 * Aegis CLI — standalone entry point
 * ----------------------------------------------------------
 * Usage:
 *   aegis run <file.aegis>       Run an Aegis file
 *   aegis check <file.aegis>     Type-check only (no execution)
 *   aegis run -e '<code>'        Run a string
 *   aegis repl                   Interactive REPL
 *   aegis --version              Print version
 *   aegis --help                 Print help
 */

import { run } from "../lib/aegis/interpreter";
import { readFileSync } from "fs";
import { createInterface } from "readline";

const VERSION = "0.12.0";

function printHelp(): void {
  console.log(`Aegis ${VERSION} — security-by-construction programming language

Usage:
  aegis run <file.aegis>       Run an Aegis file
  aegis check <file.aegis>     Type-check only (no execution)
  aegis run -e '<code>'        Run a string expression
  aegis repl                   Interactive REPL
  aegis --version              Print version
  aegis --help                 Print this help

Examples:
  aegis run hello.aegis
  aegis run -e 'fn main() { print("Hello, world!") }'
  aegis check myprogram.aegis
  aegis repl
`);
}

function runCode(code: string, checkOnly: boolean): void {
  const result = run(code);
  if (result.diagnostics.length > 0) {
    for (const d of result.diagnostics) {
      const prefix = d.kind === "error" ? "error" : d.kind;
      const loc = d.line > 0 ? `:${d.line}:${d.col}` : "";
      console.error(`[${d.phase}${loc}] ${prefix}: ${d.msg}`);
    }
  }
  if (result.ok && !checkOnly) {
    for (const line of result.output) {
      console.log(line);
    }
  }
  if (result.diagnostics.some((d) => d.kind === "error")) {
    process.exit(1);
  }
}

function runRepl(): void {
  console.log(`Aegis ${VERSION} REPL — type :help for help, :quit to exit`);
  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "aegis> " });
  let buffer = "";

  rl.prompt();

  rl.on("line", (line: string) => {
    const trimmed = line.trim();

    if (trimmed === ":quit" || trimmed === ":q") {
      rl.close();
      return;
    }
    if (trimmed === ":help") {
      console.log("Commands: :quit, :help, :check, :clear");
      rl.prompt();
      return;
    }
    if (trimmed === ":clear") {
      buffer = "";
      rl.prompt();
      return;
    }
    if (trimmed === ":check") {
      if (buffer.trim()) {
        const result = run(buffer);
        if (result.diagnostics.length === 0) {
          console.log("✓ No errors");
        } else {
          for (const d of result.diagnostics) {
            console.error(`[${d.phase}] ${d.kind}: ${d.msg}`);
          }
        }
      }
      buffer = "";
      rl.prompt();
      return;
    }

    // Accumulate lines until we can parse a complete program
    buffer += line + "\n";

    // Try to run the accumulated buffer
    // Simple heuristic: if the line ends with } or ; or is empty, try running
    if (trimmed === "" || trimmed.endsWith("}") || trimmed.endsWith(";")) {
      if (buffer.trim()) {
        const result = run(buffer);
        if (result.ok) {
          for (const line of result.output) {
            console.log(line);
          }
        } else {
          // Only print errors if they're not "unexpected eof" (incomplete input)
          const hasUnexpectedEof = result.diagnostics.some((d) =>
            d.msg.includes("eof") || d.msg.includes("Expected")
          );
          if (!hasUnexpectedEof || trimmed === "") {
            for (const d of result.diagnostics) {
              console.error(`[${d.phase}] ${d.kind}: ${d.msg}`);
            }
          }
        }
        // Keep the buffer if it was an incomplete parse, clear if it ran
        if (result.ok || (!hasUnexpectedEof && trimmed === "")) {
          buffer = "";
        }
      }
    }
    rl.prompt();
  });

  rl.on("close", () => {
    console.log("\nGoodbye!");
    process.exit(0);
  });
}

// --- Main CLI ---
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  printHelp();
  process.exit(0);
}

if (args[0] === "--version" || args[0] === "-v") {
  console.log(`Aegis ${VERSION}`);
  process.exit(0);
}

if (args[0] === "repl") {
  runRepl();
  process.exit(0);
}

if (args[0] === "run") {
  if (args[1] === "-e" || args[1] === "--eval") {
    if (!args[2]) {
      console.error("Error: no code provided for -e flag");
      process.exit(1);
    }
    runCode(args[2], false);
  } else if (args[1]) {
    try {
      const code = readFileSync(args[1], "utf8");
      runCode(code, false);
    } catch (e: any) {
      console.error(`Error: cannot read file '${args[1]}': ${e?.message || e}`);
      process.exit(1);
    }
  } else {
    console.error("Error: no file specified. Usage: aegis run <file.aegis>");
    process.exit(1);
  }
  process.exit(0);
}

if (args[0] === "check") {
  if (!args[1]) {
    console.error("Error: no file specified. Usage: aegis check <file.aegis>");
    process.exit(1);
  }
  try {
    const code = readFileSync(args[1], "utf8");
    runCode(code, true);
  } catch (e: any) {
    console.error(`Error: cannot read file '${args[1]}': ${e?.message || e}`);
    process.exit(1);
  }
  process.exit(0);
}

console.error(`Unknown command: ${args[0]}. Run 'aegis --help' for usage.`);
process.exit(1);
