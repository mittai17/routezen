import type { Metadata } from "next";
import { LegalPage } from "@/components/public/legal-page";
import { privacy } from "@/components/public/legal-content";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function Page() {
  return <LegalPage title="Privacy Policy" intro="How this version of RouteZen handles data." sections={privacy} />;
}
