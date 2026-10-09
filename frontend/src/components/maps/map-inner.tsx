"use client";
import * as React from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, ZoomControl, useMap } from "react-leaflet";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MapViewProps } from "./map-types";

const CHENNAI: [number, number] = [13.0475, 80.2209];

function pin(content: string, color: string, size = 30) {
  return L.divIcon({
    className: "rz-marker",
    html: `<div class="rz-pin" style="background:${color};width:${size}px;height:${size}px"><span>${content}</span></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    tooltipAnchor: [size / 2, -size / 2],
  });
}
const homeIcon = L.divIcon({
  className: "rz-marker",
  html: `<div class="rz-pin" style="background:#16a34a;width:34px;height:34px"><span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg></span></div>`,
  iconSize: [34, 34], iconAnchor: [17, 34], tooltipAnchor: [17, -17],
});
const toneColor = { default: "#2563eb", high: "#dc2626", success: "#16a34a" } as const;

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map((p) => p.join(",")).join("|");
  React.useEffect(() => {
    if (points.length === 0) { map.setView(CHENNAI, 11); return; }
    if (points.length === 1) { map.setView(points[0], 13); return; }
    map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

export default function MapInner({ stops, depot, geometry, height = "100%", className, showLegend = true, hideRouteNotice = false }: MapViewProps) {
  const [layer, setLayer] = React.useState<"map" | "satellite">("map");
  const points: [number, number][] = [...(depot ? [[depot.lat, depot.lng] as [number, number]] : []), ...stops.map((s) => [s.lat, s.lng] as [number, number])];
  const hasGeometry = !!geometry && geometry.length > 1;
  const needsRoute = stops.length >= 1 && !hasGeometry;

  return (
    <div className={cn("relative isolate h-full min-h-64 w-full overflow-hidden rounded-[var(--radius-card)] border border-border", className)} style={{ height }}>
      <MapContainer center={CHENNAI} zoom={11} scrollWheelZoom className="h-full w-full" zoomControl={false}>
        <ZoomControl position="bottomright" />
        {layer === "map" ? (
          <TileLayer key="osm" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
        ) : (
          <TileLayer key="esri" attribution="Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
        )}
        <Fit points={points} />
        {hasGeometry && (
          <>
            {/* White underline for contrast */}
            <Polyline positions={geometry!} pathOptions={{ color: "#ffffff", weight: 10, opacity: 0.7 }} />
            {/* Colored route line */}
            <Polyline positions={geometry!} pathOptions={{ color: "#16a34a", weight: 6, opacity: 0.95, lineCap: "round", lineJoin: "round" }} />
          </>
        )}
        {depot && (
          <Marker position={[depot.lat, depot.lng]} icon={homeIcon}>
            <Tooltip permanent direction="right" className="rz-label">{depot.label}</Tooltip>
          </Marker>
        )}
        {stops.map((s) => (
          <Marker key={s.id} position={[s.lat, s.lng]} icon={pin(String(s.order), toneColor[s.tone ?? "default"])}>
            <Tooltip direction="right" permanent={stops.length <= 10} className="rz-label">{s.label}</Tooltip>
          </Marker>
        ))}
      </MapContainer>

      <div className="absolute left-3 top-3 z-[500] inline-flex overflow-hidden rounded-lg border border-border bg-card text-xs font-semibold shadow-[var(--shadow-card)]" role="group" aria-label="Map layer">
        {(["map", "satellite"] as const).map((l) => (
          <button key={l} type="button" aria-pressed={layer === l} onClick={() => setLayer(l)} className={cn("px-3 py-1.5 capitalize", layer === l ? "bg-brand text-brand-foreground" : "text-foreground hover:bg-muted")}>{l}</button>
        ))}
      </div>

      {needsRoute && !hideRouteNotice && (
        <div role="status" className="absolute bottom-8 left-3 z-[500] flex max-w-[16rem] items-start gap-1.5 rounded-lg border border-warning/40 bg-card/95 px-2.5 py-1.5 text-[11px] font-medium shadow-[var(--shadow-card)]">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-warning" />
          <span>Routing unavailable: no road geometry, so no route line is drawn.</span>
        </div>
      )}

      {showLegend && (
        <div className="absolute right-3 top-3 z-[500] hidden rounded-lg border border-border bg-card/95 px-3 py-2 text-[11px] shadow-[var(--shadow-card)] sm:block">
          <div className="flex items-center gap-2"><span className="h-1 w-5 rounded bg-success" /> Road route{!hasGeometry && " (n/a)"}</div>
          <div className="mt-1 flex items-center gap-2"><span className="size-2.5 rounded-full bg-info" /> Delivery stop</div>
          <div className="mt-1 flex items-center gap-2"><span className="size-2.5 rounded-full bg-danger" /> High priority</div>
          <div className="mt-1 flex items-center gap-2"><span className="size-2.5 rounded-full bg-success" /> Depot</div>
        </div>
      )}
    </div>
  );
}
