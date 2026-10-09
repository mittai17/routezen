"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import * as D from "@radix-ui/react-dialog";
import { Bell, CloudRain, Menu, Moon, Search, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { DemoBadge } from "@/components/ui/badge";
import { Logo } from "@/components/brand/logo";
import { USE_DEMO_DATA } from "@/lib/api";
import { SidebarContent } from "./sidebar";

export function Topbar() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur lg:px-6">
      <D.Root open={open} onOpenChange={setOpen}>
        <D.Trigger asChild>
          <button type="button" aria-label="Open navigation" className="grid size-10 place-items-center rounded-xl border border-border bg-card lg:hidden"><Menu className="size-5" /></button>
        </D.Trigger>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-40 bg-black/50 lg:hidden" />
          <D.Content className="fixed inset-y-0 left-0 z-50 w-[260px] shadow-[var(--shadow-pop)] lg:hidden" aria-describedby={undefined}>
            <D.Title className="sr-only">Navigation</D.Title>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </D.Content>
        </D.Portal>
      </D.Root>
      <Logo tagline={false} className="lg:hidden [&_svg]:h-7 [&_div]:text-lg sm:hidden" />

      <form
        role="search"
        className="relative hidden max-w-xl flex-1 sm:block"
        onSubmit={(e) => { e.preventDefault(); if (q.trim()) router.push(`/locations?q=${encodeURIComponent(q.trim())}`); }}
      >
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          aria-label="Search location in Chennai"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search location in Chennai (e.g. T. Nagar, Anna Nagar, Adyar...)"
          className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm placeholder:text-muted-foreground/70 focus-visible:border-ring"
        />
      </form>

      <div className="ml-auto flex items-center gap-2">
        {USE_DEMO_DATA && <DemoBadge className="hidden md:inline-flex" />}
        <div className="hidden items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 xl:flex" title="Static placeholder weather, not a live feed">
          <CloudRain className="size-5 text-info" />
          <div className="leading-tight">
            <div className="text-xs font-semibold">Chennai 30°C <span className="font-normal text-muted-foreground">Light Rain</span></div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-warning">Demo weather</div>
          </div>
        </div>
        <button type="button" aria-label="Notifications" className="relative grid size-10 place-items-center rounded-xl border border-border bg-card hover:bg-muted">
          <Bell className="size-[18px]" />
        </button>
        <button type="button" onClick={toggle} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} className="grid size-10 place-items-center rounded-xl bg-brand text-brand-foreground hover:bg-brand-hover">
          {theme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </button>
        <div aria-label="Dev workspace user" className="grid size-10 place-items-center rounded-full bg-sidebar text-sm font-bold text-white">D</div>
      </div>
    </header>
  );
}
