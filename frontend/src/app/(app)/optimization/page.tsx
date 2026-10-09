import type { Metadata } from "next";
import { OptimizationResults } from "@/components/optimization/optimization-results";

export const metadata: Metadata = { title: "Optimization Results" };

export default function Page() {
  return <OptimizationResults />;
}
