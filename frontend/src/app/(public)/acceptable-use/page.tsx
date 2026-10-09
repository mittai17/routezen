import type { Metadata } from "next";
import { LegalPage } from "@/components/public/legal-page";
import { acceptableUse } from "@/components/public/legal-content";

export const metadata: Metadata = { title: "Acceptable Use" };

export default function Page() {
  return <LegalPage title="Acceptable Use" intro="Rules for using RouteZen responsibly." sections={acceptableUse} />;
}
