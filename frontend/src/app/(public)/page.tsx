import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart3, Leaf, MapPinned, Radio, Route, Truck } from "lucide-react";

export const metadata: Metadata = { title: { absolute: "RouteZen | Smarter Deliveries. Greener Tomorrow." } };

const FEATURES = [
  { icon: Truck, title: "Right vehicle, with reasons", text: "Compare bikes, autos, vans and trucks on cost, energy, capacity and deadlines. Every rejection says why." },
  { icon: Route, title: "Optimised stop order", text: "OR-Tools routing with an optional hybrid mode that tests Aer-simulated QAOA cluster orderings and keeps the validated baseline when they do not improve it." },
  { icon: MapPinned, title: "Real roads only", text: "Routes come from OSRM geometry. If routing is down, we say so rather than draw a straight line." },
  { icon: Radio, title: "Status tracking", text: "Follow planned versus actual stop times using events your team reports. No fake GPS." },
  { icon: BarChart3, title: "Analytics", text: "Cost per delivery and per km, fuel and electricity use, utilisation and deadline compliance." },
  { icon: Leaf, title: "Emissions, with assumptions", text: "Tailpipe estimates shown next to the assumptions behind them." },
];

export default function Landing() {
  return (
    <>
      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="text-sm font-semibold uppercase tracking-wide text-success">Delivery planning for Chennai</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">Smarter Deliveries. <span className="text-success">Greener Tomorrow.</span></h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">Plan routes from T. Nagar to Sholinganallur, pick the most economical vehicle for each load, and see cost, time and emissions before you dispatch.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/overview" className="inline-flex h-12 items-center gap-2 rounded-[10px] bg-brand px-6 font-semibold text-brand-foreground hover:bg-brand-hover">Open the app <ArrowRight className="size-4" /></Link>
            <Link href="/about" className="inline-flex h-12 items-center rounded-[10px] border border-border bg-background px-6 font-semibold hover:bg-muted">How it works</Link>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-14" aria-labelledby="features">
        <h2 id="features" className="text-2xl font-bold">What you can do</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="rounded-[var(--radius-card)] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-soft"><Icon className="size-5" aria-hidden /></span>
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="mx-auto max-w-6xl px-4" aria-labelledby="honest">
        <div className="rounded-[var(--radius-card)] border border-border bg-card p-6 sm:p-8">
          <h2 id="honest" className="text-xl font-bold">Honest by design</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-6 text-muted-foreground">
            <li>Demo data is always labelled. Vehicle figures show whether they are measured, external, user-supplied or assumed.</li>
            <li>The quantum option is a classical simulation. We do not claim an advantage.</li>
            <li>This is early-stage software with no accounts yet; see the <Link className="underline" href="/status">system status</Link> and the draft <Link className="underline" href="/privacy">privacy policy</Link>.</li>
          </ul>
        </div>
      </section>
    </>
  );
}
