"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function CodeBlock({
  code,
  lang = "aegis",
  filename,
  className,
  maxHeight = "none",
}: {
  code: string;
  lang?: string;
  filename?: string;
  className?: string;
  maxHeight?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className={cn("rounded-lg border border-border bg-[#0d1117] overflow-hidden", className)} dir="ltr">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-white/5">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
          </div>
          <span className="text-xs text-muted-foreground font-mono">{filename || lang}</span>
        </div>
        <button onClick={copy} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="نسخ">
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <pre
        className="p-4 text-[13px] leading-relaxed font-mono text-zinc-200 overflow-auto scroll-thin"
        style={{ maxHeight: maxHeight !== "none" ? maxHeight : undefined }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}
