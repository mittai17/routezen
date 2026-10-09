import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { ProsePage } from "@/components/public/legal-page";

export const metadata: Metadata = { title: "Contact" };

export default function Page() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <ProsePage title="Contact" intro="Questions, accessibility problems and security reports.">
      {email ? (
        <div className="rounded-[var(--radius-card)] border border-border bg-card p-5">
          <Mail className="mb-2 size-5 text-success" aria-hidden />
          <p className="text-sm text-muted-foreground">Email us at</p>
          <a className="text-lg font-semibold" href={`mailto:${email}`}>{email}</a>
        </div>
      ) : (
        <div role="note" className="rounded-[var(--radius-card)] border border-dashed border-input bg-card p-5 text-sm leading-6 text-muted-foreground">
          <p className="font-semibold text-foreground">No contact channel is configured for this deployment.</p>
          <p className="mt-1">The operator must set <code>NEXT_PUBLIC_CONTACT_EMAIL</code> before launch. We deliberately do not show a placeholder address or a form that sends nowhere.</p>
        </div>
      )}
      <section className="space-y-2 text-sm leading-6 text-muted-foreground">
        <h2 className="text-xl font-semibold text-foreground">What to include</h2>
        <ul><li>The page address and what you expected to happen.</li><li>For security reports: steps to reproduce, without real customer data.</li></ul>
      </section>
    </ProsePage>
  );
}
