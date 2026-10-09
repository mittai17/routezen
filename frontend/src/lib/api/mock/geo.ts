import type { LatLng } from "../types";

const R = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in km. Used ONLY as a labelled fallback estimate, never drawn as a road. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function tourLength(depot: LatLng, order: LatLng[], returnToDepot = true): number {
  let d = 0;
  let prev = depot;
  for (const p of order) { d += haversineKm(prev, p); prev = p; }
  return returnToDepot ? d + haversineKm(prev, depot) : d;
}

export function nearestNeighbour(depot: LatLng, pts: LatLng[]): number[] {
  const left = pts.map((_, i) => i);
  const order: number[] = [];
  let cur = depot;
  while (left.length) {
    let best = 0;
    for (let i = 1; i < left.length; i++) if (haversineKm(cur, pts[left[i]]) < haversineKm(cur, pts[left[best]])) best = i;
    const [idx] = left.splice(best, 1);
    order.push(idx);
    cur = pts[idx];
  }
  return order;
}

export function twoOpt(depot: LatLng, pts: LatLng[], order: number[]): number[] {
  let best = [...order];
  let bestLen = tourLength(depot, best.map((i) => pts[i]));
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const cand = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)];
        const len = tourLength(depot, cand.map((k) => pts[k]));
        if (len + 1e-9 < bestLen) { best = cand; bestLen = len; improved = true; }
      }
    }
  }
  return best;
}
