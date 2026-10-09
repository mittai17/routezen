"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Leaf } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav";

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <Link href="/" onClick={onNavigate} className="px-4 pb-5 pt-5" aria-label="RouteZen home">
        <Logo className="[&_div]:text-sidebar-foreground [&_.text-brand]:text-brand" />
      </Link>
      <nav aria-label="Main" className="flex-1 space-y-1 overflow-y-auto px-3">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors",
                active ? "bg-brand text-brand-foreground shadow-sm" : "text-sidebar-foreground/90 hover:bg-sidebar-elevated",
              )}
            >
              <Icon className="size-[18px] shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="space-y-3 p-3">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#3a2f0c] via-[#1d2a1f] to-[#0f2a1c] p-4">
          <svg aria-hidden viewBox="0 0 200 60" className="absolute inset-x-0 bottom-0 opacity-30" fill="#FFC629">
            <path d="M0 60V40h14V28h6v12h10V22l8-8 8 8v18h12V30h8v10h14V18h4l6-8 6 8h4v22h12V34h10v26Z" />
          </svg>
          <div className="relative">
            <div className="text-lg font-bold leading-tight">Chennai</div>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-sidebar-foreground/80"><Leaf className="size-3 text-success" /> Efficient deliveries for a cleaner city</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-elevated p-3">
          <span className="grid size-8 place-items-center rounded-lg bg-brand text-sm font-bold text-brand-foreground">D</span>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[13px] font-semibold">Dev Workspace</div>
            <div className="truncate text-[11px] text-sidebar-muted">dev-workspace, no sign-in</div>
          </div>
          <ChevronRight className="size-4 text-sidebar-muted" />
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[220px] lg:block" aria-label="Sidebar">
      <SidebarContent />
    </aside>
  );
}
