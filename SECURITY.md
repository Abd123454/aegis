# Security Policy

## Reporting a Vulnerability

Aegis's entire pitch is security-by-construction. If you find a way to
break one of the guarantees listed in the [threat table](README.md#what-aegis-is),
that is a critical bug, not a feature request.

### How to report

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please report vulnerabilities via one of:

1. **GitHub Private Vulnerability Reporting** (preferred):
   Go to the repository's **Security** tab → **Report a vulnerability**.
   This creates a private advisory visible only to maintainers.

2. **Email** (if GitHub reporting is unavailable):
   Send to the maintainers with the subject line `[AEGIS-SEC] ...`.
   If possible, encrypt with our PGP key (published in the Security tab).

### What to include

- Which security guarantee you bypassed (e.g. "SQL injection via db.query").
- The exact Aegis code that triggers it.
- What you expected to happen (rejection) vs. what actually happened.
- The interpreter version / commit hash you tested against.

### Response process

| Step | Target timeframe |
|---|---|
| Acknowledge receipt | within 48 hours |
| Initial assessment (is it a real bypass?) | within 7 days |
| Fix or mitigation | within 30 days (severity-dependent) |
| Public disclosure | after fix is released, or after 90 days if no fix |

### What counts as a vulnerability

A vulnerability is any case where the interpreter **accepts and runs** code
that should be rejected by construction. Examples:

- `db.query(single_string)` that runs instead of being rejected.
- `shell.run(single_string)` that runs instead of being rejected.
- `static mut` that parses without error.
- Array access that crashes (segfault) instead of returning `None`.
- `null` that is accepted as a literal.
- `malloc`/`free` that are accepted.
- Integer overflow that wraps silently instead of returning `Err`.
- A function without `Cap` that successfully calls `fs.read`/`net.fetch`.

### What does NOT count

- Business-logic bugs in programs written in Aegis.
- Bugs in the Next.js web app that hosts the playground (those are regular
  bugs, not Aegis security bypasses).
- Performance issues or missing features.
- Theoretical attacks that cannot be demonstrated with actual interpreter
  output.

## Safe harbor

We will not take legal action against anyone who makes a good-faith effort
to report a vulnerability, even if the report turns out to be a
non-issue. We ask the same of you: do not publicly disclose a vulnerability
until we have had a chance to fix it (see the 90-day timeline above).
