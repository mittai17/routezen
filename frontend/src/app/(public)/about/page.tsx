import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/public/legal-page";

export const metadata: Metadata = { title: "About" };

export default function Page() {
  return (
    <ProsePage title="About RouteZen" intro="Delivery route planning for Chennai, built around honest numbers.">
      <section className="space-y-3 leading-7 text-muted-foreground">
        <h2 className="text-xl font-semibold text-foreground">What it does</h2>
        <p>RouteZen helps a dispatcher turn a list of packages into a delivery plan: pick a suitable vehicle for each load, sequence stops, and compare cost, time, energy and emissions across options.</p>
        <ul>
          <li>Vehicle recommendations with a reason for every choice and every rejection.</li>
          <li>Classical route optimisation with Google OR-Tools, and a quantum option that is a labelled simulation.</li>
          <li>Road routes from OSRM. If routing is down, the map says so instead of drawing a straight line.</li>
          <li>Analytics, scenarios, reports and manual status tracking.</li>
        </ul>
      </section>
      <section className="space-y-3 leading-7 text-muted-foreground">
        <h2 className="text-xl font-semibold text-foreground">Principles</h2>
        <ul>
          <li><strong>No invented data.</strong> Demo data is labelled. Vehicle figures carry a source and a verification level (measured, external, user or assumed).</li>
          <li><strong>No quantum hype.</strong> The quantum solver is a classical simulation, shown next to classical results with no claim of advantage.</li>
          <li><strong>No fake GPS.</strong> Tracking shows planned ETAs and events that people report.</li>
        </ul>
      </section>
      <section className="space-y-3 leading-7 text-muted-foreground">
        <h2 className="text-xl font-semibold text-foreground">Status of the project</h2>
        <p>RouteZen is early-stage software without user accounts or billing. See the <Link href="/status">system status</Link> page and the <Link href="/help">help centre</Link>.</p>
      </section>
    </ProsePage>
  );
}
