"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Moon, Sun, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/about", label: "About" },
  { href: "/help", label: "Help" },
  { href: "/status", label: "Status" },
  { href: "/contact", label: "Contact" },
];
const FOOTER = {
  Product: [{ href: "/overview", label: "Open the app" }, { href: "/about", label: "About" }, { href: "/status", label: "System status" }],
  Support: [{ href: "/help", label: "Help centre" }, { href: "/help/faq", label: "FAQ" }, { href: "/contact", label: "Contact" }, { href: "/accessibility", label: "Accessibility" }],
  Legal: [{ href: "/privacy", label: "Privacy" }, { href: "/terms", label: "Terms" }, { href: "/cookies", label: "Cookies" }, { href: "/acceptable-use", label: "Acceptable use" }],
};

export function PublicHeader() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = React.useState(false);
  const link = (href: string) => cn("rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted", pathname === href || pathname.startsWith(href + "/") ? "text-foreground underline decoration-brand decoration-2 underline-offset-8" : "text-muted-foreground");
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href="/" aria-label="RouteZen home" className="rounded-lg"><Logo tagline={false} className="[&_svg]:h-8 [&_svg]:w-7" /></Link>
        <nav aria-label="Primary" className="ml-6 hidden items-center gap-1 md:flex">
          {NAV.map((n) => <Link key={n.href} href={n.href} className={link(n.href)}>{n.label}</Link>)}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={toggle} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} className="grid size-10 place-items-center rounded-xl border border-border bg-card">
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <Link href="/overview" className="hidden h-10 items-center rounded-[10px] bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand-hover sm:inline-flex">Open app</Link>
          <button type="button" aria-expanded={open} aria-controls="public-mobile-nav" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)} className="grid size-10 place-items-center rounded-xl border border-border bg-card md:hidden">
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="public-mobile-nav" aria-label="Mobile" className="border-t border-border bg-background px-4 pb-4 pt-2 md:hidden">
          <ul className="space-y-1">
            {[...NAV, { href: "/overview", label: "Open app" }].map((n) => <li key={n.href}><Link href={n.href} onClick={() => setOpen(false)} className={cn(link(n.href), "block")}>{n.label}</Link></li>)}
          </ul>
        </nav>
      )}
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo tagline={false} className="[&_svg]:h-8 [&_svg]:w-7" />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">Smarter Deliveries. Greener Tomorrow. Delivery route planning for Chennai.</p>
        </div>
        {Object.entries(FOOTER).map(([group, links]) => (
          <nav key={group} aria-label={group}>
            <h2 className="text-sm font-semibold">{group}</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {links.map((l) => <li key={l.href}><Link href={l.href} className="hover:text-foreground hover:underline">{l.label}</Link></li>)}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground">
        RouteZen. Early-stage software provided as is. Legal pages are drafts pending review.
      </div>
    </footer>
  );
}
