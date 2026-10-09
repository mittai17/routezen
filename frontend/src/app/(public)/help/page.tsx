import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/public/legal-page";

export const metadata: Metadata = { title: "Help" };

const STEPS = [
  ["Add locations", "Create your depot and common stops under Locations. Coordinates must be valid latitude and longitude."],
  ["Add vehicle profiles", "Check efficiency, price and the verification flag. Values marked assumed are placeholders for you to replace."],
  ["Plan a delivery", "In Plan Delivery add stops, review the recommended vehicle and its reasons, set constraints, then optimise."],
  ["Read the result", "The map draws a route only from real road geometry. If routing is unavailable you will see a message and a fallback distance estimate is labelled as such."],
  ["Track and review", "Report stop events in Live Tracking, then compare cost, energy and emissions in Analytics."],
];

export default function Page() {
  return (
    <ProsePage title="Help centre" intro="Getting started with RouteZen.">
      <ol className="space-y-4">
        {STEPS.map(([t, d], i) => (
          <li key={t} className="flex gap-4">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand font-bold text-brand-foreground" aria-hidden>{i + 1}</span>
            <div><h2 className="font-semibold">{t}</h2><p className="text-sm leading-6 text-muted-foreground">{d}</p></div>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted-foreground">More answers in the <Link href="/help/faq">FAQ</Link>. For component health see <Link href="/status">System status</Link>, or <Link href="/contact">contact us</Link>.</p>
    </ProsePage>
  );
}
