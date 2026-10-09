import type { Metadata } from "next";
import { LegalPage } from "@/components/public/legal-page";
import { cookies } from "@/components/public/legal-content";

export const metadata: Metadata = { title: "Cookies and Storage" };

export default function Page() {
  return <LegalPage title="Cookies and Storage" intro="What RouteZen stores in your browser." sections={cookies} />;
}
