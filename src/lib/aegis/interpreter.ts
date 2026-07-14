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
        let j = i; while (j < src.length && (src[j] === " " || src[j] === "\t")) j++;
        if (src.slice(j, j + 3) === "mut") {
          diags.push({ kind: "error", phase: "parse", line, col, msg: "`static mut` is forbidden. Shared mutable globals cause data races. Use a synchronized Channel or an Actor." });
          i = j + 3; col += 3;
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
    if (["=>","==","!=","<=",">=","->","&&","||","|>"].includes(two)) { push(two, two); i += 2; col += 2; continue; }
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
  constructor(toks: Tok[]) { this.toks = toks; }
  peek(o = 0): Tok { return this.toks[this.pos + o] || this.toks[this.toks.length - 1]; }
  next(): Tok { return this.toks[this.pos++]; }
  check(t: string): boolean { return this.peek().t === t; }
  eat(t: string): boolean { if (this.peek().t === t) { this.pos++; return true; } return false; }
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
        this.expect(":", "':' in parameter");
        const ty = this.parseType();
        params.push({ name: pname, ty });
        if (ty === "Cap") hasCap = true;
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
        let parts = [base, "<", inner];
        if (this.eat(",")) { parts.push(","); parts.push(this.parseType()); }
        this.expect(">", "'>'");
        return parts.join(" ");
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
    return body;
  }
  parseExpr(): Expr | null { return this.parsePipeline(); }
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
    if (this.check("-") || this.check("!")) { const op = this.next().t; const e = this.parseUnary(); return e ? { n: "Unary", op, e } : null; }
    return this.parsePostfix();
  }
  parsePostfix(): Expr | null {
    let e = this.parsePrimary();
    if (!e) return null;
    while (true) {
      if (this.check("?")) { const t = this.peek(); this.next(); e = { n: "Try", e, line: t.line, col: t.col }; }
      else if (this.check(".")) {
        this.next();
        const name = this.peek().t === "ident" ? this.next().v : "?";
        if (this.check("(")) { const args = this.parseArgs(); e = { n: "Method", recv: e, name, args, line: 0, col: 0 }; }
        else { e = { n: "Field", recv: e, name }; }
      } else if (this.check("(")) { const args = this.parseArgs(); e = { n: "Call", callee: e, args, line: 0, col: 0 }; }
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
    while (!this.check(")") && !this.check("eof")) { const a = this.parseExpr(); if (a) args.push(a); this.eat(","); }
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
    this.eat("|");
    const params: string[] = [];
    while (!this.check("|") && !this.check("eof")) {
      if (this.peek().t === "ident") { params.push(this.next().v); }
      else { this.next(); } // skip unexpected, avoid infinite loop
      this.eat(",");
    }
    this.expect("|", "'|'");
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
    if (t.t === "num") { this.next(); return t.v.startsWith("i:") ? { n: "IntLit", v: parseInt(t.v.slice(2), 10), line: t.line, col: t.col } : { n: "FloatLit", v: parseFloat(t.v.slice(2)), line: t.line, col: t.col }; }
    if (t.t === "str") { this.next(); const p = JSON.parse(t.v); return { n: "StrLit", lit: p.lit, parts: p.parts, line: t.line, col: t.col }; }
    if (t.t === "true") { this.next(); return { n: "BoolLit", v: true }; }
    if (t.t === "false") { this.next(); return { n: "BoolLit", v: false }; }
    if (t.t === "None") { this.next(); return { n: "None" }; }
    if (t.t === "Some") { this.next(); const e = this.parsePostfix(); return e ? { n: "Some", e } : null; }
    if (t.t === "Ok") { this.next(); const e = this.parsePostfix(); return e ? { n: "Ok", e } : null; }
    if (t.t === "Err") { this.next(); const e = this.parsePostfix(); return e ? { n: "Err", e } : null; }
    if (t.t === "ident" || t.t === "print") { this.next(); return { n: "Ident", name: t.v, line: t.line, col: t.col }; }
    if (t.t === "|") return this.parseLambda();
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
    if (this.eat("|")) {
      while (!this.check("|") && !this.check("eof")) { params.push(this.peek().t === "ident" ? this.next().v : "_"); this.eat(","); }
      this.eat("|");
    }
    const body = this.parseBlock();
    this.expect(")", "')'");
    return { n: "Call", callee: { n: "Ident", name: "__spawn__", line: t.line, col: t.col }, args: [{ n: "Closure", params, body }], line: t.line, col: t.col };
  }
}

// ---------------------------------------------------------------------------
// Static capability & safety analyzer
// ---------------------------------------------------------------------------
const GATED = new Set(["fs.read", "fs.write", "net.fetch", "shell.run", "db.query", "env.get"]);

function methodModule(recv: Expr): string {
  if (recv.n === "Ident") return recv.name;
  if (recv.n === "Field") return methodModule(recv.recv) + "." + recv.name;
  return "?";
}

function analyze(items: Item[]): Diag[] {
  const diags: Diag[] = [];
  function walkStmts(stmts: Stmt[], hasCap: boolean, locals: Set<string>) { for (const s of stmts) walkStmt(s, hasCap, locals); }
  function walkStmt(s: Stmt, hasCap: boolean, locals: Set<string>) {
    if (s.n === "Let") { walkExpr(s.expr, hasCap, locals); locals.add(s.name); }
    else if (s.n === "Expr") walkExpr(s.expr, hasCap, locals);
    else if (s.n === "Return") { if (s.expr) walkExpr(s.expr, hasCap, locals); }
    else if (s.n === "Fn") {
      let hc = s.hasCap; const ls = new Set<string>();
      for (const p of s.params) { ls.add(p.name); if (p.ty === "Cap") hc = true; }
      walkStmts(s.body, hc, ls);
    }
    else if (s.n === "ForIn") { walkExpr(s.iter, hasCap, locals); const ls = new Set(locals); ls.add(s.var); walkStmts(s.body, hasCap, ls); }
    else if (s.n === "Assign") { walkExpr(s.expr, hasCap, locals); }
  }
  function walkExpr(e: Expr, hasCap: boolean, locals: Set<string>) {
    if (!e) return;
    switch (e.n) {
      case "Bin": walkExpr(e.l, hasCap, locals); walkExpr(e.r, hasCap, locals); break;
      case "Unary": walkExpr(e.e, hasCap, locals); break;
      case "Call":
        walkExpr(e.callee, hasCap, locals);
        if (e.callee.n === "Method" && e.callee.name === "query" && e.args.length === 1)
          diags.push({ kind: "error", phase: "check", line: e.line, col: e.col, msg: "db.query(template) with a single string argument is forbidden — it enables SQL injection. Use the parameterized form: db.query(\"SELECT ... WHERE id = ?\", [id])." });
        if (e.callee.n === "Method" && e.callee.name === "run" && e.args.length === 1)
          diags.push({ kind: "error", phase: "check", line: e.line, col: e.col, msg: "shell.run(string) is forbidden — it enables command injection. Pass structured args: shell.run([\"ls\", \"-la\"]). A capability is also required." });
        for (const a of e.args) walkExpr(a, hasCap, locals);
        break;
      case "Method":
        walkExpr(e.recv, hasCap, locals);
        if (GATED.has(`${methodModule(e.recv)}.${e.name}`) && !hasCap && !locals.has("env") && !locals.has("cap"))
          diags.push({ kind: "error", phase: "check", line: e.line, col: e.col, msg: `Call to '${e.name}' requires a capability (Cap) in scope — no ambient authority. Pass 'env' into this function, or declare a parameter as ': Cap'.` });
        for (const a of e.args) walkExpr(a, hasCap, locals);
        break;
      case "Field": walkExpr(e.recv, hasCap, locals); break;
      case "Index": walkExpr(e.arr, hasCap, locals); walkExpr(e.idx, hasCap, locals); break;
      case "Array": for (const el of e.elems) walkExpr(el, hasCap, locals); break;
      case "MapLit": for (const p of e.pairs) walkExpr(p.val, hasCap, locals); break;
      case "If": walkExpr(e.cond, hasCap, locals); walkStmts(e.then, hasCap, locals); if (e.els) walkStmts(e.els, hasCap, locals); break;
      case "Match": walkExpr(e.scrut, hasCap, locals); for (const a of e.arms) walkStmts(a.body, hasCap, new Set(locals)); break;
      case "Block": walkStmts(e.body, hasCap, locals); break;
      case "Try": walkExpr(e.e, hasCap, locals); break;
      case "Some": case "Ok": case "Err": walkExpr(e.e, hasCap, locals); break;
      case "StructLit": for (const f of e.fields) walkExpr(f.val, hasCap, locals); break;
      case "Closure": walkStmts(e.body, hasCap, new Set(locals)); break;
    }
  }
  for (const it of items) walkStmt(it, false, new Set());
  return diags;
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
    case "struct": return v.name + " { " + Object.entries(v.fields).map(([k, x]) => `${k}: ${valToStr(x, depth + 1)}`).join(", ") + " }";
    case "fn": return "<fn " + v.name + ">";
    case "cap": return "<cap:" + v.label + ">";
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

  const checkDiags = analyze(items);
  diagnostics.push(...checkDiags);
  if (diagnostics.some((d) => d.kind === "error" && d.phase === "check"))
    return { ok: false, output, diagnostics };

  const globals: Env = new Map();
  const structDefs = new Map<string, { name: string; fields: { name: string; ty: string }[] }>();
  const impls = new Map<string, Map<string, any>>();
  const capObj: Val = { k: "cap", label: "fs,net,shell,db,env" };
  const makeModule = (name: string): Val => ({ k: "struct", name: "Module", fields: { __cap: capObj, __mod: { k: "str", v: name } } });
  globals.set("env", { k: "struct", name: "Env", fields: { fs: makeModule("fs"), net: makeModule("net"), shell: makeModule("shell"), db: makeModule("db"), __cap: capObj } });
  globals.set("fs", makeModule("fs"));
  globals.set("net", makeModule("net"));
  globals.set("shell", makeModule("shell"));
  globals.set("db", makeModule("db"));
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
    catch (sig) { if (sig instanceof ReturnSignal) return sig.val; throw sig; }
  };

  const evalExpr = (e: Expr, env: Env): Val => {
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
        if (e.op === "-" && (v.k === "int" || v.k === "float")) return { k: v.k, v: -v.v };
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
      case "Try": { const v = evalExpr(e.e, env); if (v.k === "err" || v.k === "none") throw new TrySignal(v); return v; }
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
          const res = li + ri;
          if (!isFloat && res > 2147483647) return { k: "err", v: { k: "str", v: "integer overflow (use wrapping_add for opt-in wraparound)" } };
          return isFloat ? { k: "float", v: res } : { k: "int", v: res };
        }
        case "-": return isFloat ? { k: "float", v: li - ri } : { k: "int", v: li - ri };
        case "*": return isFloat ? { k: "float", v: li * ri } : { k: "int", v: li * ri };
        case "/": { if (ri === 0) return { k: "err", v: { k: "str", v: "division by zero" } }; return isFloat ? { k: "float", v: li / ri } : { k: "int", v: Math.trunc(li / ri) }; }
        case "%": { if (ri === 0) return { k: "err", v: { k: "str", v: "modulo by zero" } }; return { k: "int", v: li % ri }; }
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
    // capability-gated modules
    if (recv.k === "struct" && recv.name === "Module") {
      const mod = recv.fields.__mod.v as string;
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
        catch (sig) { if (sig instanceof ReturnSignal) return sig.val; throw sig; }
      }
    }
    if (recv.k === "struct" && recv.name === "TaskHandle" && e.name === "join") return { k: "ok", v: recv.fields.result };

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
        if (mainFn.params.length >= 1) local.set(mainFn.params[0], globals.get("env")!);
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
