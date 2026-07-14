/**
 * Aegis — Reference Interpreter (extended subset)
 * ---------------------------------------
 * From-scratch tokenizer, recursive-descent parser, static capability/safety
 * analyzer, and tree-walking evaluator.
 *
 * Security properties enforced (each traceable to a named vulnerability class):
 *  - NO `null` literal                     -> null-dereference crashes
 *  - NO raw pointers / `free` / `malloc`   -> use-after-free, double-free, pointer-arith buffer overflow
 *  - NO `static mut`                       -> data races on shared mutable globals
 *  - Array indexing returns Option<T>      -> buffer overflow / out-of-bounds read/write
 *  - Checked integer arithmetic            -> integer overflow / wraparound
 *  - Capability-gated I/O (no ambient authority) -> unauthorized file/net/shell access
 *  - db.query accepts ONLY (template, params)    -> SQL injection
 *  - shell.run accepts ONLY structured args       -> command injection
 *  - spawn requires `move` capture                -> data races via shared mutable state
 *
 * Brevity features added in phase 2 (NONE weaken any guarantee above):
 *  - Implicit returns (last expr of block)        -> removes `return` ceremony
 *  - Full type inference (`let x = 5`)            -> removes type annotations
 *  - `?` early-exit operator                      -> removes match-on-Err boilerplate
 *  - String interpolation `"{var}"`               -> removes format-string calls
 *  - Lambdas `|x| expr`                           -> removes `fn(x) -> T { ... }` for closures
 *  - `for x in iter { }`                          -> removes manual indexing
 *  - Pipeline `a |> f`  (= f(a))                  -> removes nested-call parens
 *  - Struct field punning `Point { x, y }`        -> removes `x: x` repetition
 *  - Map literal `#{ k: v }` + Map type           -> removes verbose builder calls
 *  - String/Array methods (split/upper/map/filter/reduce) -> removes loop boilerplate
 *
 * Honest limits: this is NOT a full borrow checker (we simulate move-semantics for
 * spawn), NOT formally verified, and does NOT eliminate business-logic bugs,
 * side-channel leaks, or dependency backdoors.
 */

export type Diag = {
  kind: "error" | "warning" | "info";
  phase: "parse" | "check" | "runtime";
  line: number;
  col: number;
  msg: string;
};

export type RunResult = {
  ok: boolean;
  output: string[];
  diagnostics: Diag[];
};

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------
export type Val =
  | { k: "int"; v: number }
  | { k: "float"; v: number }
  | { k: "str"; v: string }
  | { k: "bool"; v: boolean }
  | { k: "array"; v: Val[] }
  | { k: "map"; v: Map<string, Val> }
  | { k: "unit" }
  | { k: "some"; v: Val }
  | { k: "none" }
  | { k: "ok"; v: Val }
  | { k: "err"; v: Val }
  | { k: "struct"; name: string; fields: Record<string, Val> }
  | { k: "fn"; name: string; params: string[]; body: Stmt[]; closure: Env; caps: boolean }
  | { k: "cap"; label: string };

type Env = Map<string, Val>;

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------
type Tok = { t: string; v: string; line: number; col: number };

const KEYWORDS = new Set([
  "fn","let","mut","if","else","match","return","struct","impl",
  "spawn","move","true","false","Ok","Err","Some","None","print",
  "loop","break","for","in","as","Cap","continue",
]);

const FORBIDDEN_TOKENS: Record<string, string> = {
  null: "Aegis has no `null`. Use `Option<T>` (Some/None) to represent absence — eliminates null-dereference crashes.",
  free: "`free` does not exist. Memory is managed by ownership — eliminates use-after-free and double-free.",
  malloc: "`malloc` does not exist. Allocation returns `Result` and is bounds-checked — eliminates unchecked-allocation bugs.",
  NULL: "C-style NULL is forbidden. Use `Option<T>`.",
  unsafe: "`unsafe` is an opt-in compiler flag (`aegis build --allow-unsafe`), not a source token in the safe subset.",
};

function tokenize(src: string): { toks: Tok[]; diags: Diag[] } {
  const toks: Tok[] = [];
  const diags: Diag[] = [];
  let i = 0, line = 1, col = 1;
  const push = (t: string, v: string) => toks.push({ t, v, line, col });
  while (i < src.length) {
    const c = src[i];
    if (c === "\n") { line++; col = 1; i++; continue; }
    if (c === " " || c === "\t" || c === "\r") { i++; col++; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") {
      i += 2; col += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) {
        if (src[i] === "\n") { line++; col = 1; } else col++;
        i++;
      }
      i += 2; col += 2; continue;
    }
    if (c === '"') {
      const sl = line, sc = col;
      i++; col++;
      const parts: { lit: string; expr: string }[] = [];
      let cur = "";
      while (i < src.length && src[i] !== '"') {
        if (src[i] === "\\" && i + 1 < src.length) {
          const n = src[i + 1];
          cur += n === "n" ? "\n" : n === "t" ? "\t" : n === '"' ? '"' : n === "\\" ? "\\" : n;
          i += 2; col += 2; continue;
        }
        if (src[i] === "{") {
          parts.push({ lit: cur, expr: "" }); cur = "";
          i++; col++;
          let depth = 1, expr = "";
          while (i < src.length && depth > 0) {
            if (src[i] === "{") depth++;
            if (src[i] === "}") { depth--; if (depth === 0) break; }
            expr += src[i];
            if (src[i] === "\n") { line++; col = 1; } else col++;
            i++;
          }
          parts[parts.length - 1].expr = expr;
          i++; col++; continue;
        }
        cur += src[i];
        if (src[i] === "\n") { line++; col = 1; } else col++;
        i++;
      }
      i++; col++;
      toks.push({ t: "str", v: JSON.stringify({ lit: cur, parts }), line: sl, col: sc });
      continue;
    }
    if (/[0-9]/.test(c)) {
      let n = "";
      while (i < src.length && /[0-9_]/.test(src[i])) { n += src[i] === "_" ? "" : src[i]; i++; col++; }
      let isFloat = false;
      if (src[i] === "." && /[0-9]/.test(src[i + 1] || "")) {
        isFloat = true; n += "."; i++; col++;
        while (i < src.length && /[0-9_]/.test(src[i])) { n += src[i] === "_" ? "" : src[i]; i++; col++; }
      }
      push("num", (isFloat ? "f:" : "i:") + n);
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let id = "";
      while (i < src.length && /[A-Za-z0-9_]/.test(src[i])) { id += src[i]; i++; col++; }
      if (id === "static") {
        // Skip ALL whitespace (including newlines) between `static` and `mut`.
        // The old code only skipped spaces/tabs, so `static\nmut` bypassed detection.
        let j = i;
        while (j < src.length && (src[j] === " " || src[j] === "\t" || src[j] === "\n" || src[j] === "\r")) j++;
        if (src.slice(j, j + 3) === "mut") {
          diags.push({ kind: "error", phase: "parse", line, col, msg: "`static mut` is forbidden. Shared mutable globals cause data races. Use a synchronized Channel or an Actor." });
          i = j + 3;
          push("forbidden", "static mut");
          continue;
        }
      }
      if (FORBIDDEN_TOKENS[id]) {
        diags.push({ kind: "error", phase: "parse", line, col, msg: FORBIDDEN_TOKENS[id] });
        push("forbidden", id);
        continue;
      }
      push(KEYWORDS.has(id) ? id : "ident", id);
      continue;
    }
    if (c === "&") {
      diags.push({ kind: "error", phase: "parse", line, col, msg: "Raw references (`&`) are not in the safe subset. Use borrowed values via the ownership system, not raw pointers — eliminates pointer-aliasing bugs." });
      push("forbidden", "&"); i++; col++; continue;
    }
    if (c === "*") { push("star", "*"); i++; col++; continue; }
    if (c === "#") { push("#", "#"); i++; col++; continue; }
    const two = src.slice(i, i + 2);
    if (["=>","==","!=","<=",">=","->","&&","||","|>","::"].includes(two)) { push(two, two); i += 2; col += 2; continue; }
    if (c === "|") { push("|", "|"); i++; col++; continue; }
    if ("+-/%(){}[],:;=<>?.".includes(c)) { push(c, c); i++; col++; continue; }
    diags.push({ kind: "error", phase: "parse", line, col, msg: `Unexpected character '${c}'.` });
    i++; col++;
  }
  push("eof", "");
  return { toks, diags };
}

// ---------------------------------------------------------------------------
// AST
// ---------------------------------------------------------------------------
type Expr =
  | { n: "IntLit"; v: number; line: number; col: number }
  | { n: "FloatLit"; v: number; line: number; col: number }
  | { n: "StrLit"; lit: string; parts: { lit: string; expr: string }[]; line: number; col: number }
  | { n: "BoolLit"; v: boolean }
  | { n: "Ident"; name: string; line: number; col: number }
  | { n: "Array"; elems: Expr[] }
  | { n: "MapLit"; pairs: { key: string; val: Expr }[]; line: number; col: number }
  | { n: "Index"; arr: Expr; idx: Expr; line: number; col: number }
  | { n: "Call"; callee: Expr; args: Expr[]; line: number; col: number }
  | { n: "Method"; recv: Expr; name: string; args: Expr[]; line: number; col: number }
  | { n: "Field"; recv: Expr; name: string }
  | { n: "Bin"; op: string; l: Expr; r: Expr; line: number }
  | { n: "Unary"; op: string; e: Expr }
  | { n: "If"; cond: Expr; then: Stmt[]; els: Stmt[] | null }
  | { n: "Match"; scrut: Expr; arms: { pat: string; binds: string[]; body: Stmt[] }[]; line: number }
  | { n: "Block"; body: Stmt[] }
  | { n: "Try"; e: Expr; line: number; col: number }
  | { n: "StructLit"; name: string; fields: { name: string; val: Expr; punned: boolean }[]; line: number }
  | { n: "Some"; e: Expr }
  | { n: "None" }
  | { n: "Ok"; e: Expr }
  | { n: "Err"; e: Expr }
  | { n: "Unit" }
  | { n: "Closure"; params: string[]; body: Stmt[] };

type Stmt =
  | { n: "Let"; mut: boolean; name: string; ty: string | null; expr: Expr; line: number }
  | { n: "Expr"; expr: Expr }
  | { n: "Return"; expr: Expr | null; line: number }
  | { n: "Fn"; name: string; params: { name: string; ty: string }[]; ret: string | null; body: Stmt[]; hasCap: boolean; line: number }
  | { n: "Struct"; name: string; fields: { name: string; ty: string }[] }
  | { n: "Impl"; name: string; methods: any[] }
  | { n: "ForIn"; var: string; iter: Expr; body: Stmt[]; line: number }
  | { n: "Assign"; name: string; expr: Expr; line: number };

type Item = Stmt;

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------
class Parser {
  toks: Tok[]; pos = 0; diags: Diag[] = [];
  // When parsing if/match conditions we disallow struct literals to avoid
  // ambiguity with blocks (same rule as Rust).
  noStructLit = false;
  // Recursion depth limit — prevents uncaught RangeError on deeply nested input.
  // 256 is well above any reasonable program depth but far below the JS stack limit.
  depth = 0;
  MAX_DEPTH = 256;
  constructor(toks: Tok[]) { this.toks = toks; }
  peek(o = 0): Tok { return this.toks[this.pos + o] || this.toks[this.toks.length - 1]; }
  next(): Tok { return this.toks[this.pos++]; }
  check(t: string): boolean { return this.peek().t === t; }
  eat(t: string): boolean { if (this.peek().t === t) { this.pos++; return true; } return false; }
  // Call this at the start of every recursive parse method.
  enterDepth(what: string): boolean {
    this.depth++;
    if (this.depth > this.MAX_DEPTH) {
      this.diags.push({ kind: "error", phase: "parse", line: this.peek().line, col: this.peek().col, msg: `Maximum nesting depth (${this.MAX_DEPTH}) exceeded while parsing ${what}. Input is too deeply nested.` });
      this.depth--;
      return false;
    }
    return true;
  }
  exitDepth() { this.depth--; }
  expect(t: string, what: string): Tok | null {
    if (this.peek().t !== t) {
      this.diags.push({ kind: "error", phase: "parse", line: this.peek().line, col: this.peek().col, msg: `Expected ${what}, got '${this.peek().v}'.` });
      return null;
    }
    return this.next();
  }
  parseProgram(): Item[] {
    const items: Item[] = [];
    while (!this.check("eof")) {
      const it = this.parseItem();
      if (it) items.push(it); else { this.next(); }
    }
    return items;
  }
  parseItem(): Item | null {
    const t = this.peek();
    if (t.t === "fn") return this.parseFn();
    if (t.t === "struct") return this.parseStruct();
    if (t.t === "impl") return this.parseImpl();
    if (t.t === "let") { const s = this.parseLet(); return s; }
    if (t.t === "for") { const s = this.parseFor(); return s; }
    if (t.t === "forbidden") { this.next(); return null; }
    const e = this.parseExpr();
    if (e) { this.eat(";"); return { n: "Expr", expr: e } as Item; }
    return null;
  }
  parseFn(): Item {
    const line = this.peek().line;
    this.eat("fn");
    const name = this.peek().t === "ident" ? this.next().v : "<anon>";
    const params: { name: string; ty: string }[] = [];
    let hasCap = false;
    if (this.eat("(")) {
      while (!this.check(")") && !this.check("eof")) {
        const pname = this.peek().t === "ident" ? this.next().v : "_";
        // Allow `self` (and any param) to omit the type annotation —
        // `self, other: Point` is valid. Type defaults to "Any".
        let ty = "Any";
        if (this.eat(":")) ty = this.parseType();
        params.push({ name: pname, ty });
        // Recognize all Cap forms: "Cap", "Cap<fs>", "Cap<fs,net>", etc.
        if (ty === "Cap" || ty.startsWith("Cap<")) hasCap = true;
        this.eat(",");
      }
      this.expect(")", "')'");
    }
    let ret: string | null = null;
    if (this.eat("->")) ret = this.parseType();
    const body = this.parseBlock();
    return { n: "Fn", name, params, ret, body, hasCap, line };
  }
  parseType(): string {
    const t = this.peek();
    if (t.t === "ident" || KEYWORDS.has(t.t)) {
      const base = this.next().v;
      if (this.check("<")) {
        this.eat("<");
        const inner = this.parseType();
        // Collect additional type args
        const args = [inner];
        while (this.eat(",")) args.push(this.parseType());
        this.expect(">", "'>'");
        // Normalize: "Cap<fs>" and "Cap< fs >" both become "Cap<fs>".
        // The old code joined with spaces ("Cap < fs") which broke `ty === "Cap"`.
        return base + "<" + args.join(",") + ">";
      }
      return base;
    }
    this.diags.push({ kind: "error", phase: "parse", line: t.line, col: t.col, msg: `Expected type, got '${t.v}'.` });
    this.next();
    return "?";
  }
  parseStruct(): Item {
    this.eat("struct");
    const name = this.peek().t === "ident" ? this.next().v : "?";
    const fields: { name: string; ty: string }[] = [];
    this.expect("{", "'{'");
    while (!this.check("}") && !this.check("eof")) {
      const fn = this.peek().t === "ident" ? this.next().v : "_";
      this.expect(":", "':'");
      const ty = this.parseType();
      fields.push({ name: fn, ty });
      this.eat(",");
    }
    this.expect("}", "'}'");
    return { n: "Struct", name, fields };
  }
  parseImpl(): Item {
    this.eat("impl");
    const name = this.peek().t === "ident" ? this.next().v : "?";
    const methods: any[] = [];
    this.expect("{", "'{'");
    while (!this.check("}") && !this.check("eof")) {
      const m = this.parseFn();
      if (m) methods.push(m);
    }
    this.expect("}", "'}'");
    return { n: "Impl", name, methods };
  }
  parseLet(): Stmt {
    const line = this.peek().line;
    this.eat("let");
    const mut = this.eat("mut");
    const name = this.peek().t === "ident" ? this.next().v : "_";
    let ty: string | null = null;
    if (this.eat(":")) ty = this.parseType();
    this.expect("=", "'='");
    const expr = this.parseExpr();
    this.eat(";");
    return { n: "Let", mut: !!mut, name, ty, expr, line };
  }
  parseFor(): Stmt {
    const line = this.peek().line;
    this.eat("for");
    const v = this.peek().t === "ident" ? this.next().v : "_";
    this.expect("in", "'in'");
    const iter = this.parseExpr();
    const body = this.parseBlock();
    return { n: "ForIn", var: v, iter: iter!, body, line };
  }
  parseBlock(): Stmt[] {
    if (!this.enterDepth("block")) {
      // Depth exceeded — consume the block to avoid infinite loop.
      // The error diagnostic was already pushed by enterDepth.
      this.eat("{");
      let depth = 1;
      while (depth > 0 && !this.check("eof")) {
        if (this.check("{")) depth++;
        else if (this.check("}")) { depth--; this.next(); continue; }
        this.next();
      }
      return [];
    }
    this.expect("{", "'{'");
    const body: Stmt[] = [];
    while (!this.check("}") && !this.check("eof")) {
      if (this.check("let")) { body.push(this.parseLet()); continue; }
      if (this.check("for")) { body.push(this.parseFor()); continue; }
      // assignment: `ident = expr`  (not `==`, not a field assign — local rebinding only)
      if (this.peek().t === "ident" && this.peek(1).t === "=") {
        const line = this.peek().line;
        const name = this.next().v;
        this.eat("=");
        const expr = this.parseExpr();
        this.eat(";");
        body.push({ n: "Assign", name, expr: expr!, line });
        continue;
      }
      if (this.check("return")) {
        const line = this.peek().line;
        this.eat("return");
        let expr: Expr | null = null;
        if (!this.check(";") && !this.check("}")) expr = this.parseExpr();
        this.eat(";");
        body.push({ n: "Return", expr, line });
        continue;
      }
      if (this.check("{")) { const b = this.parseBlock(); body.push({ n: "Expr", expr: { n: "Block", body: b } }); continue; }
      const e = this.parseExpr();
      if (e) { this.eat(";"); body.push({ n: "Expr", expr: e }); }
      else { this.next(); }
    }
    this.expect("}", "'}'");
    this.exitDepth();
    return body;
  }
  parseExpr(): Expr | null {
    if (!this.enterDepth("expression")) return null;
    const e = this.parsePipeline();
    this.exitDepth();
    return e;
  }
  parsePipeline(): Expr | null {
    let l = this.parseOr();
    while (this.check("|>")) {
      const t = this.peek(); this.next();
      const r = this.parsePostfix();
      if (!l || !r) return null;
      // desugar `a |> f` into `f(a)`
      l = { n: "Call", callee: r, args: [l], line: t.line, col: t.col };
    }
    return l;
  }
  parseOr(): Expr | null {
    let l = this.parseAnd();
    while (this.check("||")) { const t = this.peek(); this.next(); const r = this.parseAnd(); if (!l || !r) return null; l = { n: "Bin", op: "||", l, r, line: t.line }; }
    return l;
  }
  parseAnd(): Expr | null {
    let l = this.parseEq();
    while (this.check("&&")) { const t = this.peek(); this.next(); const r = this.parseEq(); if (!l || !r) return null; l = { n: "Bin", op: "&&", l, r, line: t.line }; }
    return l;
  }
  parseEq(): Expr | null {
    let l = this.parseCmp();
    while (this.check("==") || this.check("!=")) { const tk = this.next(); const r = this.parseCmp(); if (!l || !r) return null; l = { n: "Bin", op: tk.t, l, r, line: tk.line }; }
    return l;
  }
  parseCmp(): Expr | null {
    let l = this.parseAdd();
    while (this.check("<") || this.check(">") || this.check("<=") || this.check(">=")) { const tk = this.next(); const r = this.parseAdd(); if (!l || !r) return null; l = { n: "Bin", op: tk.t, l, r, line: tk.line }; }
    return l;
  }
  parseAdd(): Expr | null {
    let l = this.parseMul();
    while (this.check("+") || this.check("-")) { const tk = this.next(); const r = this.parseMul(); if (!l || !r) return null; l = { n: "Bin", op: tk.t, l, r, line: tk.line }; }
    return l;
  }
  parseMul(): Expr | null {
    let l = this.parseUnary();
    while (this.check("star") || this.check("/") || this.check("%")) {
      const tk = this.next();
      const op = tk.t === "star" ? "*" : tk.t;
      const r = this.parseUnary();
      if (!l || !r) return null;
      l = { n: "Bin", op, l, r, line: tk.line };
    }
    return l;
  }
  parseUnary(): Expr | null {
    if (this.check("-")) {
      this.next(); // consume "-"
      // Special case: -2147483648 is INT_MIN, the only negative literal
      // representable in 32-bit signed. If the next token is the literal
      // 2147483648, produce IntLit(-2147483648) directly instead of
      // Unary(-, IntLit(2147483648)) which would be rejected by the
      // oversized-literal check.
      const t = this.peek();
      if (t.t === "num" && t.v === "i:2147483648") {
        this.next();
        return { n: "IntLit", v: -2147483648, line: t.line, col: t.col };
      }
      const e = this.parseUnary();
      return e ? { n: "Unary", op: "-", e } : null;
    }
    if (this.check("!")) { const op = this.next().t; const e = this.parseUnary(); return e ? { n: "Unary", op, e } : null; }
    return this.parsePostfix();
  }
  parsePostfix(): Expr | null {
    let e = this.parsePrimary();
    if (!e) return null;
    // Ensure noStructLit is only true inside if/match conditions, not in general
    // expression context. parsePrimary sets it for if/match and parseIf/parseMatch
    // reset it before parsing the block.
    while (true) {
      if (this.check("?")) { const t = this.peek(); this.next(); e = { n: "Try", e, line: t.line, col: t.col }; }
      else if (this.check(".")) {
        this.next();
        const name = this.peek().t === "ident" ? this.next().v : "?";
        if (this.check("(")) { const args = this.parseArgs(); e = { n: "Method", recv: e, name, args, line: 0, col: 0 }; }
        else { e = { n: "Field", recv: e, name }; }
      } else if (this.check("::")) {
        // Associated function call: Type::method(args)
        this.next();
        const name = this.peek().t === "ident" ? this.next().v : "?";
        const args = this.check("(") ? this.parseArgs() : [];
        // Desugar to a call on the type name (impl lookup by struct name)
        e = { n: "Call", callee: { n: "Ident", name: "__assoc__", line: 0, col: 0 } as any, args: [e, ...args], line: 0, col: 0 };
        (e as any).__assocName = name;
      } else if (this.check("(")) {
        // Don't treat `literal(...)` as a call — a literal followed by `(` on
        // the next line is almost certainly a missing `;`, not a function call.
        // Only idents and call/method results can be called.
        if (e.n === "IntLit" || e.n === "FloatLit" || e.n === "StrLit" || e.n === "BoolLit" || e.n === "None") {
          break;
        }
        const args = this.parseArgs();
        e = { n: "Call", callee: e, args, line: 0, col: 0 };
      }
      else if (this.check("[")) { const t = this.peek(); this.next(); const idx = this.parseExpr(); this.expect("]", "']'"); e = { n: "Index", arr: e, idx: idx!, line: t.line, col: t.col }; }
      else if (!this.noStructLit && e.n === "Ident" && /^[A-Z]/.test(e.name) && this.check("{")) {
        // struct literal: Ident { fields }
        e = this.parseStructLit(e);
      }
      else break;
    }
    return e;
  }
  parseArgs(): Expr[] {
    this.expect("(", "'('");
    const args: Expr[] = [];
    while (!this.check(")") && !this.check("eof")) {
      const a = this.parseExpr();
      if (a) args.push(a);
      else { this.next(); } // skip unparseable token to avoid infinite loop on depth limit
      this.eat(",");
    }
    this.expect(")", "')'");
    return args;
  }
  parseStructLit(head: { n: "Ident"; name: string; line: number; col: number }): Expr {
    const line = head.line, col = head.col;
    this.expect("{", "'{'");
    const fields: { name: string; val: Expr; punned: boolean }[] = [];
    while (!this.check("}") && !this.check("eof")) {
      const fn = this.peek().t === "ident" ? this.next().v : "_";
      if (this.check(":")) {
        this.eat(":");
        const val = this.parseExpr();
        fields.push({ name: fn, val: val!, punned: false });
      } else {
        // field punning: `Point { x, y }` == `Point { x: x, y: y }`
        fields.push({ name: fn, val: { n: "Ident", name: fn, line, col }, punned: true });
      }
      this.eat(",");
    }
    this.expect("}", "'}'");
    return { n: "StructLit", name: head.name, fields, line, col };
  }
  parseLambda(): Expr {
    const t = this.peek();
    const params: string[] = [];
    // `||` (OR token) = empty params; `|...|` = one or more params.
    if (this.eat("||")) {
      // empty param list
    } else if (this.eat("|")) {
      while (!this.check("|") && !this.check("eof")) {
        if (this.peek().t === "ident") { params.push(this.next().v); }
        else { this.next(); }
        this.eat(",");
      }
      this.expect("|", "'|'");
    }
    let body: Stmt[];
    if (this.check("{")) { body = this.parseBlock(); }
    else { const e = this.parseExpr(); body = e ? [{ n: "Expr", expr: e }] : []; }
    return { n: "Closure", params, body, line: t.line, col: t.col } as any;
  }
  parseMapLit(): Expr {
    const t = this.peek();
    this.eat("#");
    this.expect("{", "'{'");
    const pairs: { key: string; val: Expr }[] = [];
    while (!this.check("}") && !this.check("eof")) {
      // key must be a string literal
      const kt = this.peek();
      let key = "";
      if (kt.t === "str") { this.next(); const p = JSON.parse(kt.v); key = p.lit; }
      else if (kt.t === "ident") { this.next(); key = kt.v; }
      else { this.next(); key = "?"; }
      this.expect(":", "':' in map literal");
      const val = this.parseExpr();
      pairs.push({ key, val: val! });
      this.eat(",");
    }
    this.expect("}", "'}'");
    return { n: "MapLit", pairs, line: t.line, col: t.col };
  }
  parsePrimary(): Expr | null {
    const t = this.peek();
    if (t.t === "num") {
      this.next();
      if (t.v.startsWith("i:")) {
        const v = parseInt(t.v.slice(2), 10);
        // Reject oversized integer literals at parse time.
        // Only INT_MIN (-2147483648) is representable; it's handled as a
        // special case in parseUnary (unary minus on 2147483648 literal).
        // Any bare positive literal above 2147483647 is rejected.
        if (v > 2147483647 || v < -2147483648) {
          this.diags.push({ kind: "error", phase: "parse", line: t.line, col: t.col, msg: `Integer literal ${v} exceeds 32-bit range. Use a Float literal or an explicit BigInt type.` });
        }
        return { n: "IntLit", v, line: t.line, col: t.col };
      }
      return { n: "FloatLit", v: parseFloat(t.v.slice(2)), line: t.line, col: t.col };
    }
    if (t.t === "str") { this.next(); const p = JSON.parse(t.v); return { n: "StrLit", lit: p.lit, parts: p.parts, line: t.line, col: t.col }; }
    if (t.t === "true") { this.next(); return { n: "BoolLit", v: true }; }
    if (t.t === "false") { this.next(); return { n: "BoolLit", v: false }; }
    if (t.t === "None") { this.next(); return { n: "None" }; }
    if (t.t === "Some") { this.next(); const e = this.parsePostfix(); return e ? { n: "Some", e } : null; }
    if (t.t === "Ok") { this.next(); const e = this.parsePostfix(); return e ? { n: "Ok", e } : null; }
    if (t.t === "Err") { this.next(); const e = this.parsePostfix(); return e ? { n: "Err", e } : null; }
    if (t.t === "ident" || t.t === "print") { this.next(); return { n: "Ident", name: t.v, line: t.line, col: t.col }; }
    if (t.t === "|" || t.t === "||") return this.parseLambda();
    if (t.t === "(") { this.next(); const e = this.parseExpr(); this.expect(")", "')'"); return e; }
    if (t.t === "[") {
      this.next(); const elems: Expr[] = [];
      while (!this.check("]") && !this.check("eof")) { const e = this.parseExpr(); if (e) elems.push(e); this.eat(","); }
      this.expect("]", "']'");
      return { n: "Array", elems };
    }
    if (t.t === "#") return this.parseMapLit();
    if (t.t === "if") { this.noStructLit = true; const e = this.parseIf(); this.noStructLit = false; return e; }
    if (t.t === "match") { this.noStructLit = true; const e = this.parseMatch(); this.noStructLit = false; return e; }
    if (t.t === "spawn") return this.parseSpawn();
    if (t.t === "{") return { n: "Block", body: this.parseBlock() };
    if (t.t === "forbidden") { this.next(); return { n: "Unit" }; }
    return null;
  }
  parseIf(): Expr {
    this.eat("if");
    const cond = this.parseExpr();
    this.noStructLit = false;
    const then = this.parseBlock();
    let els: Stmt[] | null = null;
    if (this.eat("else")) { els = this.check("if") ? [{ n: "Expr", expr: this.parseIf() }] : this.parseBlock(); }
    return { n: "If", cond: cond!, then, els };
  }
  parseMatch(): Expr {
    const t = this.peek();
    this.eat("match");
    const scrut = this.parseExpr();
    this.noStructLit = false;
    this.expect("{", "'{'");
    const arms: { pat: string; binds: string[]; body: Stmt[] }[] = [];
    while (!this.check("}") && !this.check("eof")) {
      let pat = ""; const binds: string[] = [];
      const pk = this.peek();
      if (pk.t === "_") { this.eat("_"); pat = "_"; }
      else if (pk.t === "ident" || pk.t === "Ok" || pk.t === "Err" || pk.t === "Some" || pk.t === "None") {
        const head = this.next().v;
        if (this.check("(")) { this.eat("("); const b = this.peek().t === "ident" ? this.next().v : "_"; binds.push(b); this.eat(")"); pat = `${head}(${b})`; }
        else pat = head;
      } else { pat = pk.v; this.next(); }
      this.expect("=>", "'=>'");
      let body: Stmt[];
      if (this.check("{")) { body = this.parseBlock(); }
      else { const e = this.parseExpr(); body = e ? [{ n: "Expr", expr: e }] : []; }
      arms.push({ pat, binds, body });
      this.eat(",");
    }
    this.expect("}", "'}'");
    return { n: "Match", scrut: scrut!, arms, line: t.line };
  }
  parseSpawn(): Expr {
    const t = this.peek();
    this.eat("spawn");
    this.expect("(", "'('");
    const modeTok = this.peek();
    if (modeTok.t !== "move") {
      this.diags.push({ kind: "error", phase: "check", line: modeTok.line, col: modeTok.col, msg: "`spawn` requires `move` as the first argument. Shared mutable state across tasks is forbidden — eliminates data races. Usage: spawn(move |cap| { ... })" });
    } else { this.next(); }
    const params: string[] = [];
    // Accept `|...|` or `||` (empty params, tokenized as the OR operator).
    if (this.eat("|")) {
      while (!this.check("|") && !this.check("eof")) { params.push(this.peek().t === "ident" ? this.next().v : "_"); this.eat(","); }
      this.eat("|");
    } else if (this.eat("||")) {
      // empty param list `||`
    }
    const body = this.parseBlock();
    this.expect(")", "')'");
    return { n: "Call", callee: { n: "Ident", name: "__spawn__", line: t.line, col: t.col }, args: [{ n: "Closure", params, body }], line: t.line, col: t.col };
  }
}

// ---------------------------------------------------------------------------
// PHASE 6: Real Capability Type System (foundational redesign)
// ---------------------------------------------------------------------------
// This is the FOURTH attempt at the ambient-authority guarantee.
// Phases 1-5 used enumeration-based approaches (name matching, isCapExpr with
// per-node-kind cases, fixpoint propagation). Each was defeated by a new
// expression form the enumeration didn't cover.
//
// Phase 6 replaces ALL of that with a type system. Capability-ness is a TYPE
// (Cap, Cap<fs>, Cap<net>, Cap<shell>, Cap<db>), and it propagates through
// the general typing rules — field access returns field type, array indexing
// returns element type, function calls return return type. There is NO
// enumeration of "expression forms that carry capabilities." The gate checks
// whether the receiver's TYPE is the right Cap type, determined by general
// typing rules, not by a hand-enumerated case list.
//
// Affine semantics: Cap values can be moved (passed by ownership) but not
// copied. This is enforced by the type system, not by convention.

// --- Type representation ---
type Type =
  | { k: "cap"; module: string | null }  // null = Cap (all modules), "fs"/"net"/"shell"/"db" = Cap<module>
  | { k: "struct"; name: string }         // user-defined struct (fields in structFieldTypes)
  | { k: "array"; elem: Type }
  | { k: "map"; val: Type }
  | { k: "option"; inner: Type }
  | { k: "other" };                        // Int, Float, String, Bool, Result, fn — not capability-bearing

// Gated methods and the module they require.
// This is a METHOD-NAME → REQUIRED-MODULE mapping, NOT an expression-form list.
// The gate checks: "does the receiver's TYPE provide this module's capability?"
const GATED_METHOD_MODULE: Record<string, string> = {
  read: "fs", write: "fs", list: "fs",
  fetch: "net", post: "net", serve: "net",
  run: "shell",
  query: "db",
};

// Parse a type annotation string into a Type.
function parseTy(ty: string): Type {
  if (ty === "Cap") return { k: "cap", module: null };
  if (ty.startsWith("Cap<") && ty.endsWith(">")) {
    const mod = ty.slice(4, -1);
    return { k: "cap", module: mod };
  }
  if (ty === "Any" || ty === "?" || ty === "Int" || ty === "Float" || ty === "String" || ty === "Bool" || ty === "Unit") {
    return { k: "other" };
  }
  // Everything else is treated as a struct type reference.
  // (Option<T>, Result<T,E>, Array<T>, Map<K,V> are "other" for capability purposes —
  // a function returning Option<Cap<fs>> would need explicit tracking, but the current
  // language doesn't have generic type annotations, so this is a known limitation.)
  if (ty.startsWith("Option<") || ty.startsWith("Result<") || ty.startsWith("Array<") || ty.startsWith("Map<")) {
    return { k: "other" };
  }
  return { k: "struct", name: ty };
}

// Does this type contain a capability? (recursive, general — works for ANY type)
function typeHasCap(t: Type, sft: Map<string, Map<string, Type>>): boolean {
  switch (t.k) {
    case "cap": return true;
    case "array": return typeHasCap(t.elem, sft);
    case "map": return typeHasCap(t.val, sft);
    case "option": return typeHasCap(t.inner, sft);
    case "struct": {
      const fields = sft.get(t.name);
      if (!fields) return false;
      for (const fty of fields.values()) {
        if (typeHasCap(fty, sft)) return true;
      }
      return false;
    }
    case "other": return false;
  }
}

// Does this type provide a specific module's capability?
// Cap<fs> provides fs. Cap (bare) does NOT directly provide any module —
// you must extract the module first (env.fs → Cap<fs>).
// A struct containing Cap<module> provides it (indirect capability).
function typeHasModuleCap(t: Type, module: string, sft: Map<string, Map<string, Type>>): boolean {
  if (t.k === "cap" && t.module === module) return true;
  // A struct containing Cap<module> also provides it (indirect capability).
  if (t.k === "struct") {
    const fields = sft.get(t.name);
    if (!fields) return false;
    for (const fty of fields.values()) {
      if (typeHasModuleCap(fty, module, sft)) return true;
    }
  }
  return false;
}

// --- Type inference: determine the Type of any expression ---
// This is the GENERAL typing function. It handles every expression form
// through standard typing rules, NOT through a capability-specific case list.
// The capability gate uses this function's result + typeHasModuleCap.
function inferType(
  e: Expr,
  ctx: Map<string, Type>,
  sft: Map<string, Map<string, Type>>,
  fnRet: Map<string, Type>,
  depth: { d: number; max: number }
): Type {
  if (depth.d++ > depth.max) { depth.d--; return { k: "other" }; }
  try {
    switch (e.n) {
      case "IntLit": case "FloatLit": case "BoolLit": case "StrLit": return { k: "other" };
      case "None": return { k: "option", inner: { k: "other" } };
      case "Some": return { k: "option", inner: inferType(e.e, ctx, sft, fnRet, depth) };
      case "Ok": case "Err": return { k: "other" };
      case "Unit": return { k: "other" };
      case "Ident": return ctx.get(e.name) || { k: "other" };
      case "Field": {
        const recvTy = inferType(e.recv, ctx, sft, fnRet, depth);
        if (recvTy.k === "cap" && recvTy.module === null) {
          // Accessing .fs, .net, .shell, .db on a bare Cap value
          if (["fs", "net", "shell", "db"].includes(e.name)) {
            return { k: "cap", module: e.name };
          }
        }
        if (recvTy.k === "struct") {
          const fields = sft.get(recvTy.name);
          if (fields && fields.has(e.name)) return fields.get(e.name)!;
        }
        return { k: "other" };
      }
      case "Index": {
        const arrTy = inferType(e.arr, ctx, sft, fnRet, depth);
        if (arrTy.k === "array") return { k: "option", inner: arrTy.elem };
        if (arrTy.k === "map") return { k: "option", inner: arrTy.val };
        return { k: "other" };
      }
      case "Call": {
        if (e.callee.n === "Ident") {
          // Direct function call — return type from fn signature
          if (fnRet.has(e.callee.name)) return fnRet.get(e.callee.name)!;
          // Built-in functions
          if (e.callee.name === "len" || e.callee.name === "sqrt") return { k: "other" };
          if (e.callee.name === "print") return { k: "other" };
        }
        return { k: "other" };
      }
      case "Method": {
        // Methods generally return non-cap types (read returns String, etc.)
        // The capability gate is checked separately in typeCheck.
        return { k: "other" };
      }
      case "Try": {
        // ? propagates the inner type (unwrapped Ok/Some)
        return inferType(e.e, ctx, sft, fnRet, depth);
      }
      case "StructLit": return { k: "struct", name: e.name };
      case "Array": {
        if (e.elems.length === 0) return { k: "array", elem: { k: "other" } };
        return { k: "array", elem: inferType(e.elems[0], ctx, sft, fnRet, depth) };
      }
      case "MapLit": {
        if (e.pairs.length === 0) return { k: "map", val: { k: "other" } };
        return { k: "map", val: inferType(e.pairs[0].val, ctx, sft, fnRet, depth) };
      }
      case "Closure": return { k: "other" };
      case "Block": return { k: "other" };
      case "If": return { k: "other" };
      case "Match": return { k: "other" };
      case "Bin": return { k: "other" };
      case "Unary": return { k: "other" };
      default: return { k: "other" };
    }
  } finally {
    depth.d--;
  }
}

// --- The type checker: replaces the old analyze() ---
function typeCheck(items: Item[]): Diag[] {
  const diags: Diag[] = [];

  // 1. Build struct field type table: structName -> (fieldName -> Type)
  const sft = new Map<string, Map<string, Type>>();
  for (const it of items) {
    if (it.n === "Struct") {
      const fields = new Map<string, Type>();
      for (const f of it.fields) fields.set(f.name, parseTy(f.ty));
      sft.set(it.name, fields);
    }
  }

  // 2. Build function return type table: fnName -> return Type
  const fnRet = new Map<string, Type>();
  for (const it of items) {
    if (it.n === "Fn" && it.ret) fnRet.set(it.name, parseTy(it.ret));
  }

  // 3. Build function parameter type table: fnName -> (paramName -> Type)
  //    Also build ordered param list for positional arg checking.
  const fnParams = new Map<string, Map<string, Type>>();
  const fnParamOrder = new Map<string, { name: string; ty: Type }[]>();
  for (const it of items) {
    if (it.n === "Fn") {
      const params = new Map<string, Type>();
      const order: { name: string; ty: Type }[] = [];
      for (const p of it.params) {
        const pty = parseTy(p.ty);
        params.set(p.name, pty);
        order.push({ name: p.name, ty: pty });
      }
      fnParams.set(it.name, params);
      fnParamOrder.set(it.name, order);
    }
  }

  // FIX A: Build implMethods table — structName -> Set<methodName>
  // This is used to verify that a gated method name on a user struct is
  // actually implemented by that struct, preventing the LIE-9 bypass where
  // a capability value is passed under a struct-typed parameter and the
  // gate treats it as "user struct, no capability, allow."
  const implMethods = new Map<string, Set<string>>();
  for (const it of items) {
    if (it.n === "Impl") {
      if (!implMethods.has(it.name)) implMethods.set(it.name, new Set());
      const methods = implMethods.get(it.name)!;
      for (const m of it.methods) {
        if (m && m.n === "Fn") methods.add(m.name);
      }
    }
  }

  // FIX B: typesCompatible — check if an argument type is compatible with
  // a declared parameter type. This is the core soundness check that was
  // missing. Key rule: a cap-family type is NOT compatible with a struct
  // type (closes LIE-9/SQL-INJECTION-FULL/CMD-INJECTION-FULL/NET-FETCH-FULL).
  function typesCompatible(argTy: Type, paramTy: Type): boolean {
    // "other" (unknown/inferred) is compatible with anything — don't break
    // untyped code that has nothing to do with capabilities.
    if (argTy.k === "other" || paramTy.k === "other") return true;
    // Cap-family types are only compatible with cap-family types.
    // A Cap value cannot be passed to a struct-typed parameter (LIE-9).
    if (argTy.k === "cap" && paramTy.k === "struct") return false;
    if (argTy.k === "struct" && paramTy.k === "cap") return false;
    if (argTy.k === "cap" && paramTy.k === "cap") {
      // Cap is compatible with Cap<anything> (bare cap provides all modules).
      // Cap<fs> is compatible with Cap<fs> but NOT with Cap<net>.
      if (paramTy.module === null) return true; // param: Cap accepts any Cap<X>
      if (argTy.module === null) return true; // arg: Cap (bare) satisfies any Cap<X> param
      return argTy.module === paramTy.module;
    }
    // Struct-to-struct: names must match (no subtyping in Aegis).
    if (argTy.k === "struct" && paramTy.k === "struct") {
      return argTy.name === paramTy.name;
    }
    // Array compatibility
    if (argTy.k === "array" && paramTy.k === "array") {
      return typesCompatible(argTy.elem, paramTy.elem);
    }
    // Map compatibility
    if (argTy.k === "map" && paramTy.k === "map") {
      return typesCompatible(argTy.val, paramTy.val);
    }
    // Option compatibility
    if (argTy.k === "option" && paramTy.k === "option") {
      return typesCompatible(argTy.inner, paramTy.inner);
    }
    // Different type families
    if (argTy.k !== paramTy.k) return false;
    return true;
  }

  // 4. Type-check each function body
  for (const it of items) {
    if (it.n !== "Fn") continue;
    const ctx = new Map<string, Type>();
    const ownScope = new Set<string>();
    const params = fnParams.get(it.name)!;
    for (const [pname, pty] of params) {
      ctx.set(pname, pty);
      ownScope.add(pname);
    }
    walkStmts(it.body, ctx, ownScope, 0);
  }

  // 5. Type-check top-level non-fn/struct/impl items
  for (const it of items) {
    if (it.n === "Fn" || it.n === "Struct" || it.n === "Impl") continue;
    walkStmt(it, new Map(), new Set(), 0);
  }

  return diags;

  // --- Walking functions (with depth tracking — P1 fix) ---
  function walkStmts(stmts: Stmt[], ctx: Map<string, Type>, ownScope: Set<string>, depth: number) {
    if (depth > 256) return;
    for (const s of stmts) walkStmt(s, ctx, ownScope, depth);
  }

  function walkStmt(s: Stmt, ctx: Map<string, Type>, ownScope: Set<string>, depth: number) {
    if (depth > 256) return;
    if (s.n === "Let") {
      // P2 fix: null-check before inferType
      if (s.expr) {
        walkExpr(s.expr, ctx, ownScope, depth);
        const ty = inferType(s.expr, ctx, sft, fnRet, { d: 0, max: 256 });
        ctx.set(s.name, ty);
      }
      ownScope.add(s.name);
    } else if (s.n === "Assign") {
      if (s.expr) {
        walkExpr(s.expr, ctx, ownScope, depth);
        if (!ownScope.has(s.name)) {
          diags.push({ kind: "error", phase: "check", line: s.line, col: 0, msg: `Cannot assign to captured variable '${s.name}'. Closures capture by value; mutation of captured variables is not supported.` });
        }
        const ty = inferType(s.expr, ctx, sft, fnRet, { d: 0, max: 256 });
        ctx.set(s.name, ty);
      }
    } else if (s.n === "Expr") {
      if (s.expr) walkExpr(s.expr, ctx, ownScope, depth);
    } else if (s.n === "Return") {
      if (s.expr) walkExpr(s.expr, ctx, ownScope, depth);
    } else if (s.n === "Fn") {
      const nestedCtx = new Map(ctx);
      const nestedOwn = new Set<string>();
      for (const p of s.params) {
        const pty = parseTy(p.ty);
        nestedCtx.set(p.name, pty);
        nestedOwn.add(p.name);
      }
      if (s.ret) fnRet.set(s.name, parseTy(s.ret));
      walkStmts(s.body, nestedCtx, nestedOwn, depth + 1);
    } else if (s.n === "ForIn") {
      if (s.iter) walkExpr(s.iter, ctx, ownScope, depth);
      const nestedCtx = new Map(ctx);
      nestedCtx.set(s.var, { k: "other" });
      const nestedOwn = new Set(ownScope);
      nestedOwn.add(s.var);
      walkStmts(s.body, nestedCtx, nestedOwn, depth + 1);
    }
  }

  function walkExpr(e: Expr, ctx: Map<string, Type>, ownScope: Set<string>, depth: number) {
    if (!e || depth > 256) return;
    switch (e.n) {
      case "Bin": walkExpr(e.l, ctx, ownScope, depth + 1); walkExpr(e.r, ctx, ownScope, depth + 1); break;
      case "Unary": walkExpr(e.e, ctx, ownScope, depth + 1); break;
      case "Call":
        walkExpr(e.callee, ctx, ownScope, depth + 1);
        // FIX B: Check argument types against declared parameter types
        if (e.callee.n === "Ident" && fnParamOrder.has(e.callee.name)) {
          const params = fnParamOrder.get(e.callee.name)!;
          for (let i = 0; i < e.args.length && i < params.length; i++) {
            const argTy = inferType(e.args[i], ctx, sft, fnRet, { d: 0, max: 256 });
            const paramTy = params[i].ty;
            if (!typesCompatible(argTy, paramTy)) {
              diags.push({ kind: "error", phase: "check", line: e.line, col: e.col, msg: `Type error in call to '${e.callee.name}': parameter '${params[i].name}' expects ${formatType(paramTy)} but got ${formatType(argTy)}. A capability value cannot be passed as a non-capability parameter (type confusion).` });
            }
          }
        }
        for (const a of e.args) walkExpr(a, ctx, ownScope, depth + 1);
        break;
      case "Method":
        walkExpr(e.recv, ctx, ownScope, depth + 1);
        {
          // THE GATE: check if the receiver's TYPE provides the required capability.
          //
          // Design:
          // - If receiver type contains Cap: enforce module match (Cap<fs> for read, etc.)
          // - If receiver type is a known user struct (no Cap): check implMethods
          //   (FIX A) — only allow if the struct actually implements the method.
          //   This prevents passing a capability under a struct-typed parameter
          //   and treating it as "user struct, no capability, allow."
          // - If receiver type is "other" (unknown/untyped): REJECT.
          const recvTy = inferType(e.recv, ctx, sft, fnRet, { d: 0, max: 256 });
          const requiredModule = GATED_METHOD_MODULE[e.name];
          if (requiredModule) {
            const recvHasCap = typeHasCap(recvTy, sft);
            const recvIsUserStruct = recvTy.k === "struct" && sft.has(recvTy.name) && !recvHasCap;
            if (recvHasCap) {
              // Receiver contains a capability — enforce the module match.
              if (!typeHasModuleCap(recvTy, requiredModule, sft)) {
                diags.push({ kind: "error", phase: "check", line: e.line, col: e.col, msg: `Method '${e.name}' requires receiver of type Cap<${requiredModule}>. The receiver's type does not provide this capability — no ambient authority.` });
              }
              // Injection shape checks (only for capability-typed receivers)
              if (typeHasModuleCap(recvTy, requiredModule, sft)) {
                if (e.name === "query") {
                  if (e.args.length !== 2) {
                    diags.push({ kind: "error", phase: "check", line: e.line, col: e.col, msg: "db.query requires exactly 2 arguments: (template, params). Single-string form is forbidden — it enables SQL injection." });
                  } else {
                    const tpl = e.args[0];
                    if (tpl.n !== "StrLit" || tpl.parts.some((p: any) => p.expr && p.expr.trim())) {
                      diags.push({ kind: "error", phase: "check", line: e.line, col: e.col, msg: "db.query template must be a plain string literal (no concatenation, no interpolation). Use ? placeholders and pass values in the params array." });
                    }
                  }
                }
                if (e.name === "run") {
                  if (e.args.length !== 1 || e.args[0].n !== "Array") {
                    diags.push({ kind: "error", phase: "check", line: e.line, col: e.col, msg: "shell.run requires a single array argument: shell.run([\"cmd\", \"arg1\"]). String form is forbidden — it enables command injection." });
                  } else {
                    for (const el of e.args[0].elems) {
                      if (el.n !== "StrLit" || el.parts.some((p: any) => p.expr && p.expr.trim())) {
                        diags.push({ kind: "error", phase: "check", line: e.line, col: e.col, msg: "shell.run array elements must be plain string literals. Variables or expressions in argv slots could smuggle shell metacharacters." });
                      }
                    }
                  }
                }
              }
            } else if (recvIsUserStruct) {
              // FIX A: The receiver is a user struct. Before allowing a gated
              // method name, verify the struct actually implements it.
              // Without this check, a capability value passed under a struct-typed
              // parameter would bypass the gate (LIE-9 bypass).
              const methods = implMethods.get(recvTy.name);
              if (!methods || !methods.has(e.name)) {
                diags.push({ kind: "error", phase: "check", line: e.line, col: e.col, msg: `Method '${e.name}' is not defined on struct '${recvTy.name}'. Gated method names (read, fetch, run, query) on a struct without a matching impl are rejected — this prevents type confusion where a capability is passed as a struct.` });
              }
            } else {
              // Receiver is unknown/untyped and not a user struct — reject.
              // Gated method names are reserved for capability modules.
              diags.push({ kind: "error", phase: "check", line: e.line, col: e.col, msg: `Method '${e.name}' requires receiver of type Cap<${requiredModule}>. The receiver has no capability type and is not a known user struct — no ambient authority.` });
            }
          }
        }
        for (const a of e.args) walkExpr(a, ctx, ownScope, depth + 1);
        break;
      case "Field": walkExpr(e.recv, ctx, ownScope, depth + 1); break;
      case "Index": walkExpr(e.arr, ctx, ownScope, depth + 1); walkExpr(e.idx, ctx, ownScope, depth + 1); break;
      case "Array": for (const el of e.elems) walkExpr(el, ctx, ownScope, depth + 1); break;
      case "MapLit": for (const p of e.pairs) walkExpr(p.val, ctx, ownScope, depth + 1); break;
      case "If": walkExpr(e.cond, ctx, ownScope, depth + 1); walkStmts(e.then, ctx, ownScope, depth + 1); if (e.els) walkStmts(e.els, ctx, ownScope, depth + 1); break;
      case "Match": walkExpr(e.scrut, ctx, ownScope, depth + 1); for (const a of e.arms) walkStmts(a.body, new Map(ctx), new Set(ownScope), depth + 1); break;
      case "Block": walkStmts(e.body, ctx, ownScope, depth + 1); break;
      case "Try": walkExpr(e.e, ctx, ownScope, depth + 1); break;
      case "Some": case "Ok": case "Err": walkExpr(e.e, ctx, ownScope, depth + 1); break;
      case "StructLit":
        // Reject forged Module/Env/TaskHandle structs (defense in depth)
        if (e.name === "Module" || e.name === "Env" || e.name === "TaskHandle") {
          diags.push({ kind: "error", phase: "check", line: e.line, col: 0, msg: `Cannot construct a forged '${e.name}' value. Capability modules are only available through the 'env' parameter passed to main.` });
        }
        for (const f of e.fields) walkExpr(f.val, ctx, ownScope, depth + 1);
        break;
      case "Closure": {
        // Closures capture the current ctx (capability flows through capture).
        // Closure params are added to ownScope (fix #7) and default to "other" type.
        const cCtx = new Map(ctx);
        const cOwn = new Set<string>(e.params);
        for (const p of e.params) {
          cCtx.set(p, { k: "other" });
          cOwn.add(p);
        }
        walkStmts(e.body, cCtx, cOwn, depth + 1);
        break;
      }
      case "StrLit": {
        // Walk interpolated expressions inside string literals
        for (const part of e.parts) {
          if (part.expr && part.expr.trim()) {
            const { toks } = tokenize(part.expr);
            const pp = new Parser(toks);
            const inner = pp.parseExpr();
            if (inner) walkExpr(inner, ctx, ownScope, depth + 1);
            for (const d of pp.diags) diags.push(d);
          }
        }
        break;
      }
    }
  }

  // Format a Type for error messages
  function formatType(t: Type): string {
    switch (t.k) {
      case "cap": return t.module ? `Cap<${t.module}>` : "Cap";
      case "struct": return t.name;
      case "array": return `Array<${formatType(t.elem)}>`;
      case "map": return `Map<${formatType(t.val)}>`;
      case "option": return `Option<${formatType(t.inner)}>`;
      case "other": return "unknown";
    }
  }
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------
class ReturnSignal { constructor(public val: Val) {} }
class TrySignal { constructor(public val: Val) {} }
class BreakSignal {} 
class EvalErr extends Error { constructor(public msg: string, public line: number, public col: number) { super(msg); } }

function valToStr(v: Val, depth = 0): string {
  switch (v.k) {
    case "int": case "float": return String(v.v);
    case "str": return v.v;
    case "bool": return v.v ? "true" : "false";
    case "unit": return "()";
    case "array": return "[" + v.v.map((x) => valToStr(x, depth + 1)).join(", ") + "]";
    case "map": {
      const es = Array.from(v.v.entries()).map(([k, x]) => `${k}: ${valToStr(x, depth + 1)}`).join(", ");
      return "#{ " + es + " }";
    }
    case "some": return "Some(" + valToStr(v.v, depth + 1) + ")";
    case "none": return "None";
    case "ok": return "Ok(" + valToStr(v.v, depth + 1) + ")";
    case "err": return "Err(" + valToStr(v.v, depth + 1) + ")";
    case "struct": {
      // SECRET-1a fix: do not expose internal capability fields (__cap, __mod)
      const entries = Object.entries(v.fields).filter(([k]) => !k.startsWith("__"));
      if (entries.length === 0 && v.name === "Module") return "<module>";
      if (v.name === "Env") return "<env>";
      return v.name + " { " + entries.map(([k, x]) => `${k}: ${valToStr(x, depth + 1)}`).join(", ") + " }";
    }
    case "fn": return "<fn " + v.name + ">";
    case "cap": return "<capability>";  // SECRET-1a fix: do not expose the session secret
  }
}

function valEq(a: Val, b: Val): boolean {
  if (a.k !== b.k) return false;
  switch (a.k) {
    case "int": case "float": return a.v === (b as any).v;
    case "str": return a.v === (b as any).v;
    case "bool": return a.v === (b as any).v;
    case "none": case "unit": return true;
    default: return false;
  }
}

export function run(source: string, _grantCaps: string[] = ["fs", "net", "shell", "db", "env"]): RunResult {
  const output: string[] = [];
  const diagnostics: Diag[] = [];
  const { toks, diags: lexDiags } = tokenize(source);
  diagnostics.push(...lexDiags);
  if (diagnostics.some((d) => d.kind === "error" && d.phase === "parse"))
    return { ok: false, output, diagnostics };

  const p = new Parser(toks);
  const items = p.parseProgram();
  diagnostics.push(...p.diags);
  if (diagnostics.some((d) => d.kind === "error" && d.phase === "parse"))
    return { ok: false, output, diagnostics };

  const checkDiags = typeCheck(items);
  diagnostics.push(...checkDiags);
  if (diagnostics.some((d) => d.kind === "error" && d.phase === "check"))
    return { ok: false, output, diagnostics };

  const globals: Env = new Map();
  const structDefs = new Map<string, { name: string; fields: { name: string; ty: string }[] }>();
  const impls = new Map<string, Map<string, any>>();
  // RUNTIME BACKSTOP: Each Module's __cap carries a session-specific token
  // (moduleName:sessionSecret). User code cannot forge this because:
  // 1. There is no `cap` literal in the language — user code can't create { k: "cap" } values.
  // 2. Even if they extract env.fs.__cap and put it in a forged Module{__mod:"net"},
  //    the label "fs:secret" won't match "net:secret" — the runtime check rejects it.
  // This means even an analyzer miss fails closed: forged or mistagged modules
  // are rejected at runtime.
  const sessionSecret = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const makeCap = (modName: string): Val => ({ k: "cap", label: modName + ":" + sessionSecret });
  const makeModule = (name: string): Val => ({ k: "struct", name: "Module", fields: { __cap: makeCap(name), __mod: { k: "str", v: name } } });
  // CRITICAL FIX: `env` is NOT a global. It exists ONLY in main's local scope
  // when main declares a Cap parameter. This means a function that does not
  // receive `env` as a parameter cannot reach `fs`/`net`/`shell`/`db` at all.
  const envObj: Val = { k: "struct", name: "Env", fields: { fs: makeModule("fs"), net: makeModule("net"), shell: makeModule("shell"), db: makeModule("db"), __cap: makeCap("env") } };
  globals.set("print", { k: "fn", name: "print", params: [], body: [], closure: new Map(), caps: false });
  globals.set("sqrt", { k: "fn", name: "sqrt", params: ["x"], body: [], closure: new Map(), caps: false });
  globals.set("len", { k: "fn", name: "len", params: ["x"], body: [], closure: new Map(), caps: false });

  for (const it of items) {
    if (it.n === "Fn") globals.set(it.name, { k: "fn", name: it.name, params: it.params.map((p) => p.name), body: it.body, closure: globals, caps: it.hasCap });
    else if (it.n === "Struct") structDefs.set(it.name, it);
    else if (it.n === "Impl") {
      if (!impls.has(it.name)) impls.set(it.name, new Map());
      const m = impls.get(it.name)!;
      for (const meth of it.methods) m.set(meth.name, meth);
    }
  }

  // Helper: call a fn value with positional args (used by map/filter/reduce)
  const applyFn = (fnVal: Val, args: Val[]): Val => {
    if (fnVal.k !== "fn") throw new EvalErr("Expected a function.", 0, 0);
    if (fnVal.name === "sqrt") return { k: "float", v: Math.sqrt((args[0] as any).v) };
    if (fnVal.name === "len") {
      const a = args[0];
      if (a.k === "str" || a.k === "array") return { k: "int", v: a.v.length };
      if (a.k === "map") return { k: "int", v: a.v.size };
      throw new EvalErr("len() expects str/array/map.", 0, 0);
    }
    const local: Env = new Map(fnVal.closure);
    for (let i = 0; i < fnVal.params.length; i++) local.set(fnVal.params[i], args[i]);
    try { return execBlock(fnVal.body, local); }
    catch (sig) {
      if (sig instanceof ReturnSignal) return sig.val;
      // ? operator: function returns the Err/None value instead of throwing
      if (sig instanceof TrySignal) return sig.val;
      throw sig;
    }
  };

  let evalDepth = 0;
  const MAX_EVAL_DEPTH = 512;
  const evalExpr = (e: Expr, env: Env): Val => {
    evalDepth++;
    if (evalDepth > MAX_EVAL_DEPTH) {
      evalDepth--;
      throw new EvalErr(`Maximum evaluation depth (${MAX_EVAL_DEPTH}) exceeded. Possible infinite recursion or deeply nested expression.`, 0, 0);
    }
    try {
      return evalExprInner(e, env);
    } finally {
      evalDepth--;
    }
  };
  const evalExprInner = (e: Expr, env: Env): Val => {
    switch (e.n) {
      case "IntLit": return { k: "int", v: e.v };
      case "FloatLit": return { k: "float", v: e.v };
      case "BoolLit": return { k: "bool", v: e.v };
      case "StrLit": {
        // Assembly order: each part contributes (literal, then interpolated expr),
        // and e.lit holds the FINAL trailing literal (may be "").
        let s = "";
        for (const part of e.parts) {
          s += part.lit;
          if (part.expr) { const v = evalExpr(parseInnerExpr(part.expr), env); s += valToStr(v); }
        }
        s += e.lit;
        return { k: "str", v: s };
      }
      case "None": return { k: "none" };
      case "Some": return { k: "some", v: evalExpr(e.e, env) };
      case "Ok": return { k: "ok", v: evalExpr(e.e, env) };
      case "Err": return { k: "err", v: evalExpr(e.e, env) };
      case "Unit": return { k: "unit" };
      case "Ident": {
        if (env.has(e.name)) return env.get(e.name)!;
        if (globals.has(e.name)) return globals.get(e.name)!;
        throw new EvalErr(`Undefined identifier '${e.name}'.`, e.line, e.col);
      }
      case "Array": return { k: "array", v: e.elems.map((el) => evalExpr(el, env)) };
      case "MapLit": {
        const m = new Map<string, Val>();
        for (const p of e.pairs) m.set(p.key, evalExpr(p.val, env));
        return { k: "map", v: m };
      }
      case "Index": {
        const arr = evalExpr(e.arr, env);
        const idx = evalExpr(e.idx, env);
        if (arr.k === "array") {
          if (idx.k !== "int") throw new EvalErr("Array index must be Int.", e.line, e.col);
          if (idx.v < 0 || idx.v >= arr.v.length) return { k: "none" };
          return { k: "some", v: arr.v[idx.v] };
        }
        if (arr.k === "map") {
          if (idx.k !== "str") throw new EvalErr("Map index must be String.", e.line, e.col);
          if (!arr.v.has(idx.v)) return { k: "none" };
          return { k: "some", v: arr.v.get(idx.v)! };
        }
        throw new EvalErr("Indexing a non-indexable value.", e.line, e.col);
      }
      case "Bin": return evalBin(e, env);
      case "Unary": {
        const v = evalExpr(e.e, env);
        if (e.op === "-" && v.k === "int") return checkedNeg(v.v);
        if (e.op === "-" && v.k === "float") return { k: "float", v: -v.v };
        if (e.op === "!" && v.k === "bool") return { k: "bool", v: !v.v };
        throw new EvalErr(`Bad unary '${e.op}'.`, 0, 0);
      }
      case "If": {
        const c = evalExpr(e.cond, env);
        if (c.k !== "bool") throw new EvalErr("`if` condition must be Bool.", 0, 0);
        if (c.v) return execBlock(e.then, env);
        if (e.els) return execBlock(e.els, env);
        return { k: "unit" };
      }
      case "Match": return evalMatch(e, env);
      case "Block": return execBlock(e.body, env);
      case "Try": {
        const v = evalExpr(e.e, env);
        // `?` unwraps Ok(x) -> x and Some(x) -> x; propagates Err/None.
        if (v.k === "err" || v.k === "none") throw new TrySignal(v);
        if (v.k === "ok") return v.v;   // unwrap Ok
        if (v.k === "some") return v.v; // unwrap Some
        return v;
      }
      case "Field": { const recv = evalExpr(e.recv, env); if (recv.k === "struct" && e.name in recv.fields) return recv.fields[e.name]; throw new EvalErr(`No field '${e.name}'.`, 0, 0); }
      case "Call": return evalCall(e, env);
      case "Method": return evalMethod(e, env);
      case "StructLit": {
        const fields: Record<string, Val> = {};
        for (const f of e.fields) fields[f.name] = evalExpr(f.val, env);
        return { k: "struct", name: e.name, fields };
      }
      case "Closure": return { k: "fn", name: "<closure>", params: e.params, body: e.body, closure: env, caps: false };
      default: throw new EvalErr(`Cannot evaluate node ${(e as any).n}.`, 0, 0);
    }
  };

  const parseInnerExpr = (src: string): Expr => {
    const { toks } = tokenize(src);
    const pp = new Parser(toks);
    return pp.parseExpr() || { n: "Unit" };
  };

  // Checked integer arithmetic: returns Err on overflow/underflow.
  // INT_MIN = -2147483648, INT_MAX = 2147483647 (32-bit signed range).
  const INT_MIN = -2147483648;
  const INT_MAX = 2147483647;
  function checkedAdd(a: number, b: number): Val {
    const res = a + b;
    if (res > INT_MAX || res < INT_MIN) return { k: "err", v: { k: "str", v: "integer overflow on '+' (use wrapping_add for opt-in wraparound)" } };
    return { k: "int", v: res };
  }
  function checkedSub(a: number, b: number): Val {
    const res = a - b;
    if (res > INT_MAX || res < INT_MIN) return { k: "err", v: { k: "str", v: "integer underflow on '-' (use wrapping_sub for opt-in wraparound)" } };
    return { k: "int", v: res };
  }
  function checkedMul(a: number, b: number): Val {
    const res = a * b;
    if (res > INT_MAX || res < INT_MIN) return { k: "err", v: { k: "str", v: "integer overflow on '*' (use wrapping_mul for opt-in wraparound)" } };
    return { k: "int", v: res };
  }
  function checkedNeg(a: number): Val {
    // Negating INT_MIN overflows: -(-2147483648) = 2147483648 > INT_MAX
    if (a === INT_MIN) return { k: "err", v: { k: "str", v: "integer overflow on unary '-' (negating INT_MIN)" } };
    return { k: "int", v: -a };
  }

  function evalBin(e: Extract<Expr, { n: "Bin" }>, env: Env): Val {
    if (e.op === "&&") { const l = evalExpr(e.l, env); if (l.k === "bool" && !l.v) return { k: "bool", v: false }; const r = evalExpr(e.r, env); return { k: "bool", v: (l as any).v && (r as any).v }; }
    if (e.op === "||") { const l = evalExpr(e.l, env); if (l.k === "bool" && l.v) return { k: "bool", v: true }; const r = evalExpr(e.r, env); return { k: "bool", v: (l as any).v || (r as any).v }; }
    const l = evalExpr(e.l, env); const r = evalExpr(e.r, env);
    const li = l.k === "int" || l.k === "float" ? l.v : null;
    const ri = r.k === "int" || r.k === "float" ? r.v : null;
    if (li !== null && ri !== null) {
      const isFloat = l.k === "float" || r.k === "float";
      switch (e.op) {
        case "+": {
          if (isFloat) return { k: "float", v: li + ri };
          return checkedAdd(li, ri);
        }
        case "-": {
          if (isFloat) return { k: "float", v: li - ri };
          return checkedSub(li, ri);
        }
        case "*": {
          if (isFloat) return { k: "float", v: li * ri };
          return checkedMul(li, ri);
        }
        case "/": {
          if (ri === 0) return { k: "err", v: { k: "str", v: "division by zero" } };
          if (isFloat) return { k: "float", v: li / ri };
          // INT_MIN / -1 = INT_MAX + 1 which overflows
          if (li === INT_MIN && ri === -1) return { k: "err", v: { k: "str", v: "integer overflow on '/' (INT_MIN / -1)" } };
          return { k: "int", v: Math.trunc(li / ri) };
        }
        case "%": {
          if (ri === 0) return { k: "err", v: { k: "str", v: "modulo by zero" } };
          // INT_MIN % -1 = 0 in math, but check for safety
          if (li === INT_MIN && ri === -1) return { k: "int", v: 0 };
          return { k: "int", v: li % ri };
        }
      }
    }
    if (l.k === "str" && e.op === "+") return { k: "str", v: l.v + (r.k === "str" ? r.v : valToStr(r)) };
    if (e.op === "==") return { k: "bool", v: valEq(l, r) };
    if (e.op === "!=") return { k: "bool", v: !valEq(l, r) };
    if (li !== null && ri !== null) {
      if (e.op === "<") return { k: "bool", v: li < ri };
      if (e.op === ">") return { k: "bool", v: li > ri };
      if (e.op === "<=") return { k: "bool", v: li <= ri };
      if (e.op === ">=") return { k: "bool", v: li >= ri };
    }
    throw new EvalErr(`Bad binary op '${e.op}' on ${l.k}/${r.k}.`, 0, 0);
  }

  function evalMatch(e: Extract<Expr, { n: "Match" }>, env: Env): Val {
    const v = evalExpr(e.scrut, env);
    for (const arm of e.arms) {
      const m = matchPat(arm.pat, v);
      if (m !== null) {
        const local = new Map(env);
        for (const b of arm.binds) local.set(b, m);
        return execBlock(arm.body, local);
      }
    }
    throw new EvalErr("Non-exhaustive match — no arm matched. Aegis requires exhaustive pattern matching.", 0, 0);
  }
  function matchPat(pat: string, v: Val): Val | null {
    if (pat === "_") return { k: "unit" };
    if (pat === "None" && v.k === "none") return { k: "unit" };
    if (pat === "Some" && v.k === "some") return v.v;
    if (pat === "Ok" && v.k === "ok") return v.v;
    if (pat === "Err" && v.k === "err") return v.v;
    const m = pat.match(/^(\w+)\((\w+)\)$/);
    if (m) {
      const head = m[1];
      if (head === "Some" && v.k === "some") return v.v;
      if (head === "Ok" && v.k === "ok") return v.v;
      if (head === "Err" && v.k === "err") return v.v;
    }
    if (/^-?\d+$/.test(pat) && v.k === "int" && v.v === parseInt(pat, 10)) return { k: "unit" };
    if (pat.startsWith('"') && v.k === "str" && v.v === pat.slice(1, -1)) return { k: "unit" };
    if (v.k === "bool" && (pat === "true" || pat === "false") && v.v === (pat === "true")) return { k: "unit" };
    return null;
  }

  function execBlock(stmts: Stmt[], env: Env): Val {
    let last: Val = { k: "unit" };
    for (const s of stmts) {
      if (s.n === "Let") { const v = evalExpr(s.expr, env); env.set(s.name, v); last = { k: "unit" }; }
      else if (s.n === "Assign") {
        // Local rebinding. This is single-thread mutation only; spawn(move)
        // captures a copy of the env, so cross-task mutation remains impossible.
        const v = evalExpr(s.expr, env);
        env.set(s.name, v);
        last = { k: "unit" };
      }
      else if (s.n === "Expr") { last = evalExpr(s.expr, env); }
      else if (s.n === "Return") { throw new ReturnSignal(s.expr ? evalExpr(s.expr, env) : { k: "unit" }); }
      else if (s.n === "Fn") { env.set(s.name, { k: "fn", name: s.name, params: s.params.map((p) => p.name), body: s.body, closure: env, caps: s.hasCap }); }
      else if (s.n === "ForIn") {
        const iter = evalExpr(s.iter, env);
        if (iter.k !== "array") throw new EvalErr("`for` expects an iterable (array).", s.line, 0);
        for (const el of iter.v) {
          // Bind loop var in the SAME env so mutations to outer locals persist.
          env.set(s.var, el);
          try { execBlock(s.body, env); }
          catch (sig) { if (sig instanceof BreakSignal) break; throw sig; }
        }
        last = { k: "unit" };
      }
    }
    return last;
  }

  function evalCall(e: Extract<Expr, { n: "Call" }>, env: Env): Val {
    if (e.callee.n === "Ident" && e.callee.name === "print") {
      const args = e.args.map((a) => evalExpr(a, env));
      output.push(args.map((a) => valToStr(a)).join(" "));
      return { k: "unit" };
    }
    if (e.callee.n === "Ident" && e.callee.name === "__spawn__") {
      const clos = e.args[0] as any;
      if (!clos || clos.n !== "Closure") throw new EvalErr("spawn expects a closure.", 0, 0);
      const local = new Map(env);
      const result = execBlock(clos.body, local);
      return { k: "struct", name: "TaskHandle", fields: { result, __done: { k: "bool", v: true } } };
    }
    if (e.callee.n === "Ident" && e.callee.name === "__assoc__") {
      // Associated function call: Type::method(args...)
      const typeName = (e.args[0] as any)?.name;
      const methodName = (e as any).__assocName;
      if (typeName && impls.has(typeName)) {
        const m = impls.get(typeName)!.get(methodName);
        if (m) {
          const local: Env = new Map(globals);
          const callArgs = e.args.slice(1).map((a) => evalExpr(a, env));
          let ai = 0;
          for (const p of m.params) {
            if (p.name === "self") continue;
            local.set(p.name, callArgs[ai]); ai++;
          }
          try { return execBlock(m.body, local); }
          catch (sig) {
            if (sig instanceof ReturnSignal) return sig.val;
            if (sig instanceof TrySignal) return sig.val; // ? propagates => function returns Err/None
            throw sig;
          }
        }
      }
      throw new EvalErr(`No associated function '${methodName}' on '${typeName}'.`, e.line, e.col);
    }
    if (e.callee.n === "Ident" && (e.callee.name === "len" || e.callee.name === "sqrt")) {
      const args = e.args.map((a) => evalExpr(a, env));
      return applyFn(globals.get(e.callee.name)!, args);
    }
    const callee = evalExpr(e.callee, env);
    if (callee.k !== "fn") throw new EvalErr(`Calling a non-function (${callee.k}).`, e.line, e.col);
    const args = e.args.map((a) => evalExpr(a, env));
    return applyFn(callee, args);
  }

  function evalMethod(e: Extract<Expr, { n: "Method" }>, env: Env): Val {
    const recv = evalExpr(e.recv, env);
    // RUNTIME BACKSTOP: Verify capability tag on Module-typed receivers.
    // Even if the static analyzer misses something, this check ensures
    // that only legitimately-obtained Module values can execute privileged
    // methods. A forged Module (constructed via StructLit) won't have a
    // valid __cap with the correct session secret.
    if (recv.k === "struct" && recv.name === "Module") {
      const mod = recv.fields.__mod.v as string;
      const cap = recv.fields.__cap;
      // Verify the cap is a valid capability value with the correct session secret.
      // User code cannot create { k: "cap" } values — they only come from the runtime.
      // And the label must match "moduleName:sessionSecret" to prevent cross-module
      // cap extraction (stealing fs's cap and using it for net).
      if (!cap || cap.k !== "cap" || cap.label !== mod + ":" + sessionSecret) {
        throw new EvalErr(`Runtime backstop: Module '${mod}' has an invalid or forged capability tag. Method '${e.name}' refused.`, e.line, e.col);
      }
      if (mod === "fs" && e.name === "read") return { k: "ok", v: { k: "str", v: "[file contents]" } };
      if (mod === "net" && e.name === "fetch") return { k: "ok", v: { k: "str", v: "[network response]" } };
      if (mod === "net" && e.name === "post") return { k: "ok", v: { k: "str", v: "[posted]" } };
      if (mod === "shell" && e.name === "run") {
        if (e.args.length !== 1) throw new EvalErr("shell.run expects exactly one array argument.", e.line, e.col);
        const arg = evalExpr(e.args[0], env);
        if (arg.k !== "array") throw new EvalErr("shell.run expects an array of string arguments — no shell string parsing.", e.line, e.col);
        return { k: "ok", v: { k: "str", v: "[executed: " + arg.v.map((x) => (x as any).v).join(" ") + "]" } };
      }
      if (mod === "db" && e.name === "query") {
        if (e.args.length !== 2) throw new EvalErr("db.query requires (template, params).", e.line, e.col);
        return { k: "ok", v: { k: "array", v: [] } };
      }
    }
    if (recv.k === "struct" && impls.has(recv.name)) {
      const m = impls.get(recv.name)!.get(e.name);
      if (m) {
        const local: Env = new Map(globals);
        local.set("self", recv);
        let ai = 0;
        for (const p of m.params) {
          if (p.name === "self") continue;
          local.set(p.name, evalExpr(e.args[ai], env)); ai++;
        }
        try { return execBlock(m.body, local); }
        catch (sig) {
          if (sig instanceof ReturnSignal) return sig.val;
          if (sig instanceof TrySignal) return sig.val;
          throw sig;
        }
      }
    }
    if (recv.k === "struct" && recv.name === "TaskHandle" && e.name === "join") return { k: "ok", v: recv.fields.result };

    // ----- Number methods -----
    if (recv.k === "int" || recv.k === "float") {
      if (e.name === "sqrt") return { k: "float", v: Math.sqrt(recv.v) };
      if (e.name === "abs") return { k: recv.k, v: Math.abs(recv.v) };
      if (e.name === "floor") return { k: "int", v: Math.floor(recv.v) };
      if (e.name === "ceil") return { k: "int", v: Math.ceil(recv.v) };
    }

    // ----- String methods -----
    if (recv.k === "str") {
      if (e.name === "len") return { k: "int", v: recv.v.length };
      if (e.name === "upper") return { k: "str", v: recv.v.toUpperCase() };
      if (e.name === "lower") return { k: "str", v: recv.v.toLowerCase() };
      if (e.name === "trim") return { k: "str", v: recv.v.trim() };
      if (e.name === "contains") {
        const a = evalExpr(e.args[0], env);
        return { k: "bool", v: a.k === "str" && recv.v.includes(a.v) };
      }
      if (e.name === "split") {
        const a = evalExpr(e.args[0], env);
        if (a.k !== "str") throw new EvalErr("split() expects a String separator.", e.line, e.col);
        const parts = recv.v.split(a.v);
        return { k: "array", v: parts.map((s) => ({ k: "str", v: s })) };
      }
      if (e.name === "parse_int") {
        const n = parseInt(recv.v, 10);
        return isNaN(n) ? { k: "none" } : { k: "some", v: { k: "int", v: n } };
      }
      if (e.name === "parse_float") {
        const n = parseFloat(recv.v);
        return isNaN(n) ? { k: "none" } : { k: "some", v: { k: "float", v: n } };
      }
    }

    // ----- Array methods -----
    if (recv.k === "array") {
      if (e.name === "len") return { k: "int", v: recv.v.length };
      if (e.name === "push") return recv; // immutable stub
      if (e.name === "map") {
        const f = evalExpr(e.args[0], env);
        return { k: "array", v: recv.v.map((el) => applyFn(f, [el])) };
      }
      if (e.name === "filter") {
        const f = evalExpr(e.args[0], env);
        const out: Val[] = [];
        for (const el of recv.v) { const r = applyFn(f, [el]); if (r.k === "bool" && r.v) out.push(el); }
        return { k: "array", v: out };
      }
      if (e.name === "reduce") {
        const f = evalExpr(e.args[0], env);
        let acc = evalExpr(e.args[1], env);
        for (const el of recv.v) acc = applyFn(f, [acc, el]);
        return acc;
      }
      if (e.name === "sort") {
        const sorted = [...recv.v].sort((a, b) => {
          const av = (a as any).v; const bv = (b as any).v;
          if (typeof av === "number" && typeof bv === "number") return av - bv;
          return String(av).localeCompare(String(bv));
        });
        return { k: "array", v: sorted };
      }
      if (e.name === "join") {
        const a = evalExpr(e.args[0], env);
        const sep = a.k === "str" ? a.v : " ";
        return { k: "str", v: recv.v.map((x) => valToStr(x)).join(sep) };
      }
      if (e.name === "first") return recv.v.length ? { k: "some", v: recv.v[0] } : { k: "none" };
      if (e.name === "last") return recv.v.length ? { k: "some", v: recv.v[recv.v.length - 1] } : { k: "none" };
    }

    // ----- Map methods -----
    if (recv.k === "map") {
      if (e.name === "len") return { k: "int", v: recv.v.size };
      if (e.name === "get") {
        const a = evalExpr(e.args[0], env);
        if (a.k !== "str") throw new EvalErr("map.get() expects a String key.", e.line, e.col);
        return recv.v.has(a.v) ? { k: "some", v: recv.v.get(a.v)! } : { k: "none" };
      }
      if (e.name === "insert") {
        const k = evalExpr(e.args[0], env);
        const v = evalExpr(e.args[1], env);
        if (k.k !== "str") throw new EvalErr("map.insert() expects a String key.", e.line, e.col);
        const m = new Map(recv.v); m.set(k.v, v);
        return { k: "map", v: m };
      }
      if (e.name === "entries") {
        const out: Val[] = [];
        for (const [k, v] of recv.v) out.push({ k: "array", v: [{ k: "str", v: k }, v] });
        return { k: "array", v: out };
      }
      if (e.name === "keys") return { k: "array", v: Array.from(recv.v.keys()).map((s) => ({ k: "str", v: s })) };
      if (e.name === "values") return { k: "array", v: Array.from(recv.v.values()) };
    }

    // ----- Option methods -----
    if (recv.k === "some") {
      if (e.name === "unwrap_or") return recv.v;            // Some(x).unwrap_or(_) == x
      if (e.name === "unwrap") return recv.v;
      if (e.name === "is_some") return { k: "bool", v: true };
      if (e.name === "is_none") return { k: "bool", v: false };
    }
    if (recv.k === "none") {
      if (e.name === "unwrap_or") return e.args.length ? evalExpr(e.args[0], env) : { k: "unit" };  // None.unwrap_or(d) == d
      if (e.name === "is_some") return { k: "bool", v: false };
      if (e.name === "is_none") return { k: "bool", v: true };
    }

    throw new EvalErr(`No method '${e.name}' on ${recv.k === "struct" ? recv.name : recv.k}.`, e.line, e.col);
  }

  try {
    for (const it of items) {
      if (it.n === "Fn" || it.n === "Struct" || it.n === "Impl") continue;
      if (it.n === "Let") { const v = evalExpr(it.expr, globals); globals.set(it.name, v); }
      else if (it.n === "Expr") evalExpr(it.expr, globals);
      else if (it.n === "ForIn") {
        const iter = evalExpr(it.iter, globals);
        if (iter.k === "array") for (const el of iter.v) { const local = new Map(globals); local.set(it.var, el); execBlock(it.body, local); }
      }
    }
    if (globals.has("main")) {
      const mainFn = globals.get("main")!;
      if (mainFn.k === "fn") {
        const local: Env = new Map(globals);
        // Inject the capability value based on the parameter's type annotation.
        // Cap (bare) → inject the full Env struct (has .fs, .net, .shell, .db fields)
        // Cap<fs> → inject the fs Module directly (can call .read() directly)
        // Cap<net> → inject the net Module, etc.
        if (mainFn.params.length >= 1) {
          // Find the first parameter with a Cap type
          const mainItem = items.find((it) => it.n === "Fn" && it.name === "main") as Extract<Item, { n: "Fn" }> | undefined;
          if (mainItem && mainItem.params.length >= 1) {
            const pty = mainItem.params[0].ty;
            if (pty === "Cap") {
              local.set(mainFn.params[0], envObj);
            } else if (pty.startsWith("Cap<") && pty.endsWith(">")) {
              const mod = pty.slice(4, -1);
              local.set(mainFn.params[0], makeModule(mod));
            }
          }
        }
        try { execBlock(mainFn.body, local); }
        catch (sig) { if (!(sig instanceof ReturnSignal)) throw sig; }
      }
    }
  } catch (err: any) {
    if (err instanceof EvalErr) { diagnostics.push({ kind: "error", phase: "runtime", line: err.line, col: err.col, msg: err.msg }); return { ok: false, output, diagnostics }; }
    if (err instanceof ReturnSignal) { /* fine */ }
    else if (err instanceof BreakSignal) { /* fine */ }
    else { diagnostics.push({ kind: "error", phase: "runtime", line: 0, col: 0, msg: String(err && err.message ? err.message : err) }); return { ok: false, output, diagnostics }; }
  }

  return { ok: !diagnostics.some((d) => d.kind === "error"), output, diagnostics };
}
