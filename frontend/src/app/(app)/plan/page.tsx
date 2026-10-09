import type { Metadata } from "next";
import { PlanWorkspace } from "@/components/plan/plan-workspace";

export const metadata: Metadata = { title: "Plan Delivery" };

export default function PlanPage() {
  return <PlanWorkspace />;
}
