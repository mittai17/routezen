"use client";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { MapViewProps } from "./map-types";

const Inner = dynamic(() => import("./map-inner"), {
  ssr: false,
  loading: () => <Skeleton className="h-full min-h-64 w-full" />,
});

/** Client-only Leaflet map. Route polyline is drawn only from the `geometry` prop (real road geometry). */
export function MapView(props: MapViewProps) {
  return <Inner {...props} />;
}
export type { MapStop, MapDepot, MapViewProps } from "./map-types";
