"use client";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Map, Navigation, Hotel, UtensilsCrossed, Binoculars, CalendarDays, DollarSign, Radio, CheckCheck } from "lucide-react";
import { getTrip } from "@/lib/api/travel";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Routes", href: "routes", icon: Navigation },
  { label: "Checkpoints", href: "checkpoints", icon: Map },
  { label: "Stays", href: "stays", icon: Hotel },
  { label: "Food", href: "food", icon: UtensilsCrossed },
  { label: "Attractions", href: "attractions", icon: Binoculars },
  { label: "Itinerary", href: "itinerary", icon: CalendarDays },
  { label: "Budget", href: "budget", icon: DollarSign },
  { label: "Final", href: "final", icon: CheckCheck },
  { label: "Live", href: "live", icon: Radio },
] as const;

export default function TripLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const { data: trip } = useQuery({ queryKey: ["travel-trip", id], queryFn: () => getTrip(id) });

  function isActive(seg: string) {
    return pathname.includes(`/${seg}`);
  }

  return (
    <div className="space-y-4">
      {/* Trip header */}
      <div className="flex items-center gap-3">
        <Link href="/smart-travel" className="grid size-8 place-items-center rounded-xl border border-border bg-card hover:bg-muted transition-colors">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold leading-tight">
            {trip?.name ?? "Loading trip…"}
          </h1>
          {trip && (
            <p className="text-xs text-muted-foreground">
              {trip.origin_name.split(",")[0]} → {trip.destination_name.split(",")[0]}
              {trip.departure_date ? ` · ${trip.departure_date}` : ""}
              {` · ${trip.adults} adult${trip.adults !== 1 ? "s" : ""}`}
            </p>
          )}
        </div>
      </div>

      {/* Sub-nav */}
      <nav aria-label="Trip sections" className="overflow-x-auto">
        <ol className="flex min-w-max gap-1 rounded-2xl border border-border bg-card p-1.5">
          {NAV.map(({ label, href, icon: Icon }) => (
            <li key={href}>
              <Link
                href={`/smart-travel/${id}/${href}`}
                aria-current={isActive(href) ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors whitespace-nowrap",
                  isActive(href)
                    ? "bg-brand text-brand-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                {label}
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      {/* Page content */}
      {children}
    </div>
  );
}
