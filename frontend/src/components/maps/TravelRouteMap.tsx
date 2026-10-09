"use client";
/**
 * TravelRouteMap — Leaflet map for Smart Travel.
 * Renders multiple route polylines (for comparison) + checkpoint pins.
 * Must be loaded with dynamic(..., { ssr: false }) due to Leaflet's browser dependency.
 */
import * as React from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, ZoomControl, useMap, Circle } from "react-leaflet";
import type { TravelCheckpoint, TravelPlace } from "@/lib/api/travel";
import { cn } from "@/lib/utils";

const INDIA_CENTER: [number, number] = [20.5937, 78.9629];

export interface TravelRoute {
  geometry: [number, number][];
  color: string;
  active: boolean;
  label?: string;
}

export interface TravelMapProps {
  routes?: TravelRoute[];
  checkpoints?: TravelCheckpoint[];
  places?: TravelPlace[];
  height?: string | number;
  className?: string;
  selectedCheckpointId?: string;
}

function makePin(content: string, color: string, size = 30) {
  return L.divIcon({
    className: "rz-marker",
    html: `<div class="rz-pin" style="background:${color};width:${size}px;height:${size}px"><span style="transform:rotate(45deg);display:block">${content}</span></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    tooltipAnchor: [size / 2, -size / 2],
  });
}

function makePlacePin(icon: string, color: string) {
  return L.divIcon({
    className: "rz-marker",
    html: `<div style="background:${color};width:28px;height:28px;border-radius:50%;display:grid;place-items:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);font-size:14px">${icon}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

const PIN_COLORS: Record<string, string> = {
  origin: "#16a34a",
  destination: "#dc2626",
  mandatory: "#2563eb",
  optional: "#f59e0b",
  default: "#8b5cf6",
};

const PLACE_ICONS: Record<string, string> = {
  stay: "🏨",
  restaurant: "🍽️",
  attraction: "⭐",
};
const PLACE_COLORS: Record<string, string> = {
  stay: "#7c3aed",
  restaurant: "#ea580c",
  attraction: "#0284c7",
};

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map(p => p.join(",")).join("|");
  React.useEffect(() => {
    if (!points.length) { map.setView(INDIA_CENTER, 5); return; }
    if (points.length === 1) { map.setView(points[0], 10); return; }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 12 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

export default function TravelRouteMap({ routes = [], checkpoints = [], places = [], height = "100%", className, selectedCheckpointId }: TravelMapProps) {
  const [layer, setLayer] = React.useState<"map" | "satellite">("map");

  const allPoints: [number, number][] = [
    ...checkpoints.map(c => [c.lat, c.lng] as [number, number]),
    ...routes.flatMap(r => r.geometry),
  ];

  return (
    <div className={cn("relative isolate overflow-hidden rounded-[var(--radius-card)] border border-border", className)} style={{ height }}>
      <MapContainer center={INDIA_CENTER} zoom={5} scrollWheelZoom className="h-full w-full" zoomControl={false}>
        <ZoomControl position="bottomright" />
        {layer === "map" ? (
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
        ) : (
          <TileLayer attribution="Tiles &copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
        )}

        <FitBounds points={allPoints} />

        {/* Route polylines */}
        {routes.map((r, i) => r.geometry.length > 1 && (
          <Polyline
            key={i}
            positions={r.geometry}
            pathOptions={{
              color: r.color,
              weight: r.active ? 5 : 3,
              opacity: r.active ? 0.9 : 0.4,
              dashArray: r.active ? undefined : "8 6",
            }}
          />
        ))}

        {/* Checkpoint pins */}
        {checkpoints.map((cp, i) => {
          const color = PIN_COLORS[cp.type] ?? PIN_COLORS.default;
          const label = i === 0 ? "S" : i === checkpoints.length - 1 ? "E" : String(i);
          const isSelected = cp.id === selectedCheckpointId;
          return (
            <Marker
              key={cp.id}
              position={[cp.lat, cp.lng]}
              icon={makePin(label, color, isSelected ? 36 : 30)}
            >
              <Tooltip permanent direction="right" className="rz-label">{cp.name}</Tooltip>
            </Marker>
          );
        })}

        {/* Place pins */}
        {places.map(p => (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={makePlacePin(PLACE_ICONS[p.category] ?? "📍", PLACE_COLORS[p.category] ?? "#666")}
          >
            <Tooltip direction="top" className="rz-label">{p.name}</Tooltip>
          </Marker>
        ))}
      </MapContainer>

      {/* Layer switcher */}
      <div className="absolute left-3 top-3 z-[500] inline-flex overflow-hidden rounded-lg border border-border bg-card text-xs font-semibold shadow-[var(--shadow-card)]">
        {(["map", "satellite"] as const).map(l => (
          <button key={l} type="button" aria-pressed={layer === l} onClick={() => setLayer(l)} className={cn("px-3 py-1.5 capitalize", layer === l ? "bg-brand text-brand-foreground" : "text-foreground hover:bg-muted")}>
            {l}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="absolute right-3 top-3 z-[500] rounded-lg border border-border bg-card/95 px-3 py-2 text-[10px] shadow-[var(--shadow-card)] hidden sm:block">
        <div className="flex items-center gap-2"><span className="size-3 rounded-full bg-success" /> Origin</div>
        <div className="flex items-center gap-2 mt-1"><span className="size-3 rounded-full bg-danger" /> Destination</div>
        <div className="flex items-center gap-2 mt-1"><span className="size-3 rounded-full bg-info" /> Mandatory</div>
        <div className="flex items-center gap-2 mt-1"><span className="size-3 rounded-full bg-warning" /> Optional</div>
      </div>
    </div>
  );
}
