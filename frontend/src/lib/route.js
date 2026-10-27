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

// Point at fraction t of the route, plus heading and the part already driven.
export function along(coords, t) {
  const f = Math.min(1, Math.max(0, t));
  const total = lengthKm(coords);
  let target = total * f;
  for (let i = 1; i < coords.length; i++) {
    const seg = km(coords[i - 1], coords[i]);
    if (target <= seg || i === coords.length - 1) {
      const r = seg ? Math.min(1, target / seg) : 0;
      const a = coords[i - 1], b = coords[i];
      const point = [a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r];
      return { point, heading: bearing(a, b), done: [...coords.slice(0, i), point] };
    }
    target -= seg;
  }
  return { point: coords[0], heading: 0, done: [coords[0]] };
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
