import type { Metadata } from "next";
import { TrackingWorkspace } from "@/components/tracking/tracking-workspace";

export const metadata: Metadata = { title: "Live Tracking" };

export default function Page() {
  return <TrackingWorkspace />;
}
