"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Play, Loader2, ShieldCheck, ShieldX, Terminal } from "lucide-react";
import { EXAMPLES, type Example } from "@/lib/aegis/examples";
import { cn } from "@/lib/utils";

type RunResult = {
  ok: boolean;
  output: string[];
  diagnostics: { kind: string; phase: string; line: number; col: number; msg: string }[];
};

export default function Playground() {
  const [code, setCode] = useState<string>(EXAMPLES[0].code);
  const [activeId, setActiveId] = useState<string>(EXAMPLES[0].id);
  const [result, setResult] = useState<RunResult | null>(null);
  const [loading, setLoading] = useState(false);

  const runCode = useCallback(async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/aegis/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json()) as RunResult;
      setResult(data);
    } catch (e: any) {
      setResult({ ok: false, output: [], diagnostics: [{ kind: "error", phase: "runtime", line: 0, col: 0, msg: String(e?.message || e) }] });
    } finally {
      setLoading(false);
    }
  }, [code]);

  const loadExample = (ex: Example) => {
    setActiveId(ex.id);
    setCode(ex.code);
    setResult(null);
  };

  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-4">
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">الأمثلة</div>
        <div className="space-y-1 max-h-[180px] lg:max-h-[560px] overflow-y-auto scroll-thin pr-1">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.id}
              onClick={() => loadExample(ex)}
              className={cn(
                "w-full text-right px-3 py-2 rounded-md text-sm transition-colors border border-transparent",
                activeId === ex.id
                  ? "bg-emerald-500/10 border-emerald-500/30 text-foreground"
                  : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{ex.arabicTitle}</span>
                {ex.category === "exploit" ? (
                  <ShieldX className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                )}
              </div>
              <div className="text-[10px] text-muted-foreground/70 truncate font-mono" dir="ltr">{ex.title}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 min-w-0">
        <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/40">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Terminal className="h-3.5 w-3.5" />
              <span className="font-mono">main.aegis</span>
            </div>
            <Button size="sm" onClick={runCode} disabled={loading} className="h-7 gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              تشغيل
            </Button>
          </div>
          <Textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            className="font-mono text-[13px] leading-relaxed border-0 rounded-none bg-transparent min-h-[300px] resize-y focus-visible:ring-0"
            dir="ltr"
          />
        </div>

        {result && (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-muted/40">
              {result.ok ? (
                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15">نجح التشغيل</Badge>
              ) : (
                <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/15">حُظر — فشل آمن</Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {result.diagnostics.length > 0 && `${result.diagnostics.length} تشخيص`}
              </span>
            </div>
            <div className="p-3 space-y-2 max-h-[340px] overflow-y-auto scroll-thin">
              {result.output.length > 0 && (
                <div className="rounded-md bg-black/40 border border-border p-3 font-mono text-[13px]" dir="ltr">
                  {result.output.map((line, i) => (
                    <div key={i} className="text-emerald-300">{line}</div>
                  ))}
                </div>
              )}
              {result.diagnostics.map((d, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-md border p-3 text-[13px] font-mono",
                    d.kind === "error"
                      ? "bg-rose-500/5 border-rose-500/30 text-rose-200"
                      : "bg-amber-500/5 border-amber-500/30 text-amber-200"
                  )}
                  dir="ltr"
                >
                  <div className="flex items-center gap-2 mb-1 text-[11px] uppercase tracking-wide opacity-70">
                    <span>{d.phase}</span>
                    {d.line > 0 && <span>line {d.line}:{d.col}</span>}
                  </div>
                  {d.msg}
                </div>
              ))}
              {result.output.length === 0 && result.diagnostics.length === 0 && (
                <div className="text-sm text-muted-foreground">— لا مخرجات —</div>
              )}
            </div>
          </div>
        )}

        {(() => {
          const ex = EXAMPLES.find((x) => x.id === activeId);
          if (!ex) return null;
          return (
            <div className={cn(
              "rounded-lg border p-4 text-sm",
              ex.category === "exploit" && ex.expectedBlocked
                ? "bg-rose-500/5 border-rose-500/20"
                : ex.category === "exploit"
                ? "bg-amber-500/5 border-amber-500/20"
                : "bg-emerald-500/5 border-emerald-500/20"
            )}>
              {ex.vulnerabilityClass && (
                <div className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground mb-1.5" dir="ltr">
                  {ex.vulnerabilityClass}
                </div>
              )}
              <p className="leading-relaxed">{ex.explanation}</p>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
