import type { Metadata } from "next";
import { ScenariosPage } from "@/components/scenarios/scenarios-page";

export const metadata: Metadata = { title: "Scenarios" };

export default function Page() {
  return <ScenariosPage />;
}
