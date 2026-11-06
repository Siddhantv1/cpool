// Moving a vehicle along a route line: position and heading at a given fraction (0 → 1) of the way.

const toRad = (d) => (d * Math.PI) / 180;

// Distance in km between two [lng, lat] points (haversine).
export function km(a, b) {
  const dLat = toRad(b[1] - a[1]), dLng = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

export function lengthKm(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += km(coords[i - 1], coords[i]);
  return total;
}

// Compass bearing in degrees from a to b (0 = north, 90 = east).
export function bearing(a, b) {
  const y = Math.sin(toRad(b[0] - a[0])) * Math.cos(toRad(b[1]));
  const x = Math.cos(toRad(a[1])) * Math.sin(toRad(b[1])) - Math.sin(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.cos(toRad(b[0] - a[0]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// Km from the start to each point, measured once per route: the car is placed on the same route several times a second,
// and re-measuring every point each time made the ride screens slow.
const measured = new WeakMap();
function kmSoFar(coords) {
  let sums = measured.get(coords);
  if (!sums) {
    sums = [0];
    for (let i = 1; i < coords.length; i++) sums.push(sums[i - 1] + km(coords[i - 1], coords[i]));
    measured.set(coords, sums);
  }
  return sums;
}

// Point at fraction t of the route, plus heading and the part already driven.
export function along(coords, t) {
  if (coords.length < 2) return { point: coords[0], heading: 0, done: [coords[0]] };
  const sums = kmSoFar(coords);
  const target = sums[sums.length - 1] * Math.min(1, Math.max(0, t));
  // The first point at or past the target (binary search; the last one if rounding overshoots).
  let lo = 1;
  let hi = coords.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sums[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  const a = coords[lo - 1], b = coords[lo];
  const seg = sums[lo] - sums[lo - 1];
  const r = seg ? Math.min(1, (target - sums[lo - 1]) / seg) : 0;
  const point = [a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r];
  return { point, heading: bearing(a, b), done: [...coords.slice(0, lo), point] };
}

// [west, south, east, north] around all points.
export function boundsOf(points) {
  const lngs = points.map((p) => p[0]), lats = points.map((p) => p[1]);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

export const lineFeature = (coords) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } });

// Index of the route point closest to p (where a guest joins the host's route).
export function nearestIndex(coords, p) {
  let best = 0;
  for (let i = 1; i < coords.length; i++) if (km(coords[i], p) < km(coords[best], p)) best = i;
  return best;
}

// Traffic for the live card's progress bar: the route in 10 equal stretches, each coloured by its average traffic,
// neighbours of the same colour merged. Returns [{ length, color }] adding up to 100, or null without traffic data.
// congestion[i] is Mapbox's level for the line from coords[i] to coords[i + 1].
const LEVEL = { low: 0, unknown: 0, moderate: 1, heavy: 2, severe: 3 };
const TRAFFIC = ["#0F9D63", "#F59E0B", "#DC2626"]; // moving, slow, jammed
// Worked out once per route: the ride screens ask for it on every redraw.
const trafficMemo = new WeakMap();
export function trafficSegments(coords, congestion) {
  const hit = coords && trafficMemo.get(coords);
  if (hit && hit.congestion === congestion) return hit.out;
  const out = computeTraffic(coords, congestion);
  if (coords) trafficMemo.set(coords, { congestion, out });
  return out;
}
function computeTraffic(coords, congestion) {
  const n = Math.min((coords?.length ?? 0) - 1, congestion?.length ?? 0);
  if (n < 1) return null;
  const lines = Array.from({ length: n }, (_, i) => ({ d: km(coords[i], coords[i + 1]), level: LEVEL[congestion[i]] ?? 0 }));
  const total = lines.reduce((a, l) => a + l.d, 0);
  if (!total) return null;
  const weight = Array(10).fill(0);
  const covered = Array(10).fill(0);
  let at = 0;
  for (const l of lines) {
    const start = (at / total) * 10;
    const end = ((at + l.d) / total) * 10;
    at += l.d;
    for (let s = Math.floor(start); s < Math.min(10, Math.ceil(end)); s++) {
      const overlap = Math.min(end, s + 1) - Math.max(start, s);
      weight[s] += overlap * l.level;
      covered[s] += overlap;
    }
  }
  const out = [];
  for (let s = 0; s < 10; s++) {
    const avg = covered[s] ? weight[s] / covered[s] : 0;
    // Amber once about a third of the stretch is slow, red once it's mostly heavy (short jams still show).
    const color = TRAFFIC[avg >= 1.3 ? 2 : avg >= 0.3 ? 1 : 0];
    if (out.length && out[out.length - 1].color === color) out[out.length - 1].length += 10;
    else out.push({ length: 10, color });
  }
  return out;
}

// The live card's bar as [{ length, color }] adding up to 100: the part already driven in grey-blue, the stretch ahead
// to the next stop in traffic colours (green without traffic data), later legs in light grey.
// progress (where the car is), legStart and legEnd (the current leg) are 0–100 of the whole trip; traffic is
// trafficSegments() of the current leg.
const DRIVEN = "#AAB6D3";
const LATER = "#D6DCEA";
export function liveBar(progress, legStart, legEnd, traffic) {
  const car = Math.min(Math.max(progress, legStart), legEnd);
  const parts = [[0, car, DRIVEN]];
  let at = legStart;
  for (const s of traffic ?? [{ length: 100, color: TRAFFIC[0] }]) {
    const end = at + (s.length / 100) * (legEnd - legStart);
    parts.push([Math.max(at, car), end, s.color]);
    at = end;
  }
  parts.push([legEnd, 100, LATER]);
  const out = [];
  for (const [a, b, color] of parts) {
    if (b - a < 0.01) continue;
    const last = out[out.length - 1];
    if (last?.color === color) last.length += b - a;
    else out.push({ length: b - a, color });
  }
  return out;
}
