export interface MapStop { id: string; lat: number; lng: number; label: string; order: number; tone?: "default" | "high" | "success" }
export interface MapDepot { lat: number; lng: number; label: string }
export interface MapViewProps {
  stops: MapStop[];
  depot?: MapDepot;
  /** Road geometry as [lat, lng] pairs from the routing provider. When absent NOTHING is drawn between stops. */
  geometry?: [number, number][] | null;
  height?: number | string;
  className?: string;
  showLegend?: boolean;
  /** Hide the "routing unavailable" notice for views that never draw a route (e.g. the Locations map). */
  hideRouteNotice?: boolean;
}
