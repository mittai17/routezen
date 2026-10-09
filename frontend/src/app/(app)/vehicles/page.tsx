import type { Metadata } from "next";
import { VehiclesWorkspace } from "@/components/vehicles/vehicles-workspace";

export const metadata: Metadata = { title: "Vehicle Profiles" };

export default function Page() {
  return <VehiclesWorkspace />;
}
