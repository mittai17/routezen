import type { Metadata } from "next";
import { LegalPage } from "@/components/public/legal-page";
import { accessibility } from "@/components/public/legal-content";

export const metadata: Metadata = { title: "Accessibility" };

export default function Page() {
  return <LegalPage title="Accessibility" intro="Our approach to accessible design and its current limits." sections={accessibility} />;
}
