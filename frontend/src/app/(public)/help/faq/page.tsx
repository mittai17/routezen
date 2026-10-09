import type { Metadata } from "next";
import { ProsePage } from "@/components/public/legal-page";

export const metadata: Metadata = { title: "FAQ" };

const FAQ: [string, string][] = [
  ["Do I need an account?", "No. This version has no sign-in; it uses a single development workspace. Do not host it publicly with real customer data."],
  ["Is the data on screen real?", "Only if the app is connected to the backend. In demo mode every dataset is labelled \"Demo data\"."],
  ["Why is there no route line on the map?", "Route lines come from the OSRM routing service. If it cannot be reached, RouteZen shows \"routing unavailable\" rather than drawing a straight line. Straight-line distances, when shown, are labelled fallback estimates."],
  ["Is the quantum optimiser really quantum?", "No. QAOA runs in a classical Qiskit Aer simulation. Hybrid mode tests small simulated cluster orderings, validates the full route with OR-Tools, and keeps the classical baseline when the candidate is worse. RouteZen makes no claim of quantum advantage."],
  ["How reliable are the cost and emissions numbers?", "They are only as good as your inputs. Vehicle profiles carry a verification level; \"assumed\" means a placeholder. Emissions are tailpipe estimates, not certified accounting."],
  ["Does Live Tracking show where my vehicle is?", "No. There is no GPS integration. It shows planned ETAs and the status events you report, plus a clearly labelled simulation mode."],
  ["Where do my settings go?", "In the backend database for the workspace, or in your browser's local storage in demo mode."],
];

export default function Page() {
  return (
    <ProsePage title="Frequently asked questions">
      <div className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-card">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group p-4">
            <summary className="cursor-pointer list-none font-semibold marker:hidden [&::-webkit-details-marker]:hidden">{q}</summary>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{a}</p>
          </details>
        ))}
      </div>
    </ProsePage>
  );
}
