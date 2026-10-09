import type { Metadata } from "next";
import { LegalPage } from "@/components/public/legal-page";
import { terms } from "@/components/public/legal-content";

export const metadata: Metadata = { title: "Terms of Use" };

export default function Page() {
  return <LegalPage title="Terms of Use" intro="Draft terms for using RouteZen." sections={terms} />;
}
