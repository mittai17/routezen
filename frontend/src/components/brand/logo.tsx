import { cn } from "@/lib/utils";

/** Compact icon mark: map pin with a route path inside (original RouteZen artwork). */
export function LogoMark({ className, title = "RouteZen" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 48 56" className={cn("h-9 w-8 shrink-0", className)} role="img" aria-label={title} fill="none">
      <path
        d="M24 2C12.4 2 3 11 3 22.200c0 14.3 16.2 30.5 19.2 33.400a2.6 2.6 0 0 0 3.6 0C28.8 52.7 45 36.5 45 22.2 45 11 35.6 2 24 2Z"
        fill="#FFC629"
      />
      <circle cx="24" cy="22" r="13" fill="#0B0F14" />
      <path d="M17 28.500c4-1 3-8 7.5-8.5 4.5-.5 2.5 6.5 7.5 7" stroke="#22C55E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="17" cy="28.5" r="2.6" fill="#FFC629" />
      <circle cx="32" cy="27.5" r="2.6" fill="#22C55E" />
    </svg>
  );
}

/** Wordmark: "Route" + emphasised "Zen". */
export function Wordmark({ className, tagline = false }: { className?: string; tagline?: boolean }) {
  return (
    <div className={cn("leading-none", className)}>
      <div className="text-[22px] font-bold tracking-tight">
        Route<span className="text-brand">Zen</span>
      </div>
      {tagline && <div className="mt-1 whitespace-nowrap text-[8px] font-medium text-sidebar-muted">Smarter Deliveries. Greener Tomorrow.</div>}
    </div>
  );
}

export function Logo({ className, tagline = true }: { className?: string; tagline?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <Wordmark tagline={tagline} />
    </div>
  );
}
