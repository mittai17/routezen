import type { Metadata } from "next";
import { ProsePage } from "@/components/public/legal-page";
import { StatusCheck } from "@/components/public/status-check";

export const metadata: Metadata = { title: "System Status" };

export default function Page() {
  return (
    <ProsePage title="System status" intro="Live readiness checks from the RouteZen API.">
      <StatusCheck />
    </ProsePage>
  );
}
