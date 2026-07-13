"use client";

import { useState } from "react";
import { CodeBlock } from "./CodeBlock";
import { cn } from "@/lib/utils";

type LangCode = { lang: string; label: string; code: string };

export function LangCompare({ items, filename }: { items: LangCode[]; filename?: string }) {
  const [active, setActive] = useState(items[0].lang);
  const current = items.find((i) => i.lang === active) || items[0];
  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-2">
        {items.map((it) => (
          <button
            key={it.lang}
            onClick={() => setActive(it.lang)}
            className={cn(
              "px-3 py-1 text-xs font-mono rounded-md border transition-colors",
              active === it.lang
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            {it.label}
          </button>
        ))}
      </div>
      <CodeBlock code={current.code} lang={current.lang} filename={filename || current.lang} />
    </div>
  );
}
