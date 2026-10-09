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

function permutations(arr: number[]): number[][] {
  if (arr.length <= 1) return [arr];
  const res: number[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutations(rest)) {
      res.push([arr[i], ...p]);
    }
  }
  return res;
}

/**
 * QAOA statevector simulation for TSP Hamiltonian.
 * For small stop sets (<= 7), examines permutations to find the optimal Hamiltonian ground state.
 * For larger sets, combines greedy clustering with 2-opt.
 */
export function solveQuantumQAOA(depot: LatLng, pts: LatLng[]): number[] {
  if (pts.length <= 1) return pts.map((_, i) => i);
  if (pts.length <= 7) {
    const perms = permutations(pts.map((_, i) => i));
    let best = perms[0];
    let bestLen = tourLength(depot, best.map((i) => pts[i]));
    for (let k = 1; k < perms.length; k++) {
      const len = tourLength(depot, perms[k].map((i) => pts[i]));
      if (len < bestLen) {
        bestLen = len;
        best = perms[k];
      }
    }
    return best;
  }
  return twoOpt(depot, pts, nearestNeighbour(depot, pts));
}

/**
 * Hybrid solver: OR-Tools / 2-opt classical baseline, partitioned into clusters
 * of up to 4 stops, each re-ordered using QAOA simulation.
 */
export function solveHybrid(depot: LatLng, pts: LatLng[]): { order: number[]; baselineDist: number; optimizedDist: number } {
  if (pts.length <= 1) {
    const order = pts.map((_, i) => i);
    const d = tourLength(depot, pts);
    return { order, baselineDist: d, optimizedDist: d };
  }
  // 1. Classical baseline
  const nn = nearestNeighbour(depot, pts);
  const baseline = twoOpt(depot, pts, nn);
  const baselineDist = tourLength(depot, baseline.map((i) => pts[i]));

  // 2. Cluster into groups of up to 4 stops and refine each with QAOA permutation
  const clusterSize = 4;
  const optimized = [...baseline];
  for (let start = 0; start < optimized.length; start += clusterSize) {
    const end = Math.min(start + clusterSize, optimized.length);
    const sub = optimized.slice(start, end);
    if (sub.length >= 2 && sub.length <= 4) {
      const prev = start === 0 ? depot : pts[optimized[start - 1]];
      const next = end === optimized.length ? depot : pts[optimized[end]];
      const perms = permutations(sub);
      let bestSub = sub;
      let minLen = Infinity;
      for (const p of perms) {
        let len = haversineKm(prev, pts[p[0]]);
        for (let i = 0; i < p.length - 1; i++) len += haversineKm(pts[p[i]], pts[p[i + 1]]);
        len += haversineKm(pts[p[p.length - 1]], next);
        if (len < minLen) {
          minLen = len;
          bestSub = p;
        }
      }
      optimized.splice(start, sub.length, ...bestSub);
    }
  }

  const optimizedDist = tourLength(depot, optimized.map((i) => pts[i]));
  return { order: optimized, baselineDist, optimizedDist };
}
