import * as React from "react";
import { Info } from "lucide-react";

export interface LegalSection { heading: string; body: React.ReactNode }

/** Shared layout for policy pages. Every policy shows the draft notice: legal text needs review before commercial launch. */
export function ProsePage({ title, intro, children, draft = false }: { title: string; intro?: string; children: React.ReactNode; draft?: boolean }) {
  return (
    <article className="mx-auto max-w-3xl px-4 pb-4 pt-10 sm:pt-14">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
      {intro && <p className="mt-3 text-lg text-muted-foreground">{intro}</p>}
      {draft && (
        <aside role="note" className="mt-6 flex gap-3 rounded-[var(--radius-card)] border border-warning/40 bg-warning-soft p-4 text-sm">
          <Info className="mt-0.5 size-5 shrink-0 text-warning" />
          <p><strong>Draft for review.</strong> This text describes how this version of RouteZen behaves. It has not been reviewed by a lawyer and must be reviewed and adapted before any commercial launch. It is not legal advice and does not claim compliance with any law, standard or certification.</p>
        </aside>
      )}
      <div className="mt-8 space-y-8 [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">{children}</div>
    </article>
  );
}

export function LegalPage({ title, intro, sections }: { title: string; intro: string; sections: LegalSection[] }) {
  return (
    <ProsePage title={title} intro={intro} draft>
      <p className="text-xs text-muted-foreground">Draft version 0.1. No effective date has been set.</p>
      {sections.map((s) => (
        <section key={s.heading} aria-labelledby={`h-${s.heading.replace(/\W+/g, "-").toLowerCase()}`}>
          <h2 id={`h-${s.heading.replace(/\W+/g, "-").toLowerCase()}`} className="text-xl font-semibold">{s.heading}</h2>
          <div className="mt-2 space-y-3 text-[15px] leading-7 text-muted-foreground">{s.body}</div>
        </section>
      ))}
    </ProsePage>
  );
}
