import type { Metadata } from "next";
import { LocationsWorkspace } from "@/components/locations/locations-workspace";

export const metadata: Metadata = { title: "Locations" };

export default function Page() {
  return <LocationsWorkspace />;
}
