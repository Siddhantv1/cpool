// Real road routes from the Mapbox Directions API: the line to draw, distance, travel time with traffic, and turn-by-turn steps.
// Uses the public token from .env. Without a token or internet it falls back to straight lines and an estimated time.
import { useEffect, useMemo, useState } from "react";
import { lengthKm, nearestIndex } from "./route";

const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";
const BASE = "https://api.mapbox.com/directions/v5/mapbox";
const cache = new Map();

// Mapbox maneuver -> MaterialCommunityIcons name for the turn card.
export function stepIcon(type, modifier = "") {
  if (type === "arrive") return "flag-checkered";
  if (type === "depart") return "navigation-variant";
  if (type === "roundabout" || type === "rotary" || type.startsWith("roundabout")) return "rotate-right";
  if (modifier.includes("uturn")) return "arrow-u-left-top";
  if (modifier.includes("left")) return "arrow-left-top";
  if (modifier.includes("right")) return "arrow-right-top";
  return "arrow-up";
}

// Turns a Directions API response into { coords, km, minutes, legs: [{ coords, km, minutes, steps: [{ text, icon, startKm, endKm }] }] }.
export function parseRoute(json) {
  const r = json?.routes?.[0];
  if (!r) throw new Error("no_route");
  const legs = r.legs.map((leg) => {
    let at = 0;
    const coords = [];
    const steps = leg.steps.map((s) => {
      const line = s.geometry?.coordinates ?? [];
      coords.push(...(coords.length ? line.slice(1) : line));
      const step = { text: s.maneuver.instruction, icon: stepIcon(s.maneuver.type, s.maneuver.modifier), startKm: at, endKm: at + s.distance / 1000 };
      at = step.endKm;
      return step;
    });
    return { coords, km: leg.distance / 1000, minutes: leg.duration / 60, steps };
  });
  return { coords: r.geometry.coordinates, km: r.distance / 1000, minutes: r.duration / 60, legs };
}

// Straight-line stand-in when the API can't be reached (about 24 km/h in city traffic, 5 km/h walking).
function estimate(points, profile) {
  const speed = profile === "walking" ? 5 : 24;
  const legs = points.slice(1).map((p, i) => {
    const coords = [points[i], p];
    const km = lengthKm(coords);
    return { coords, km, minutes: (km / speed) * 60, steps: [{ text: "Head to the next stop", icon: "arrow-up", startKm: 0, endKm: km }] };
  });
  return { coords: points, km: legs.reduce((a, l) => a + l.km, 0), minutes: legs.reduce((a, l) => a + l.minutes, 0), legs, estimated: true };
}

// points: [[lng, lat], ...] (2 to 25 stops). profile: "driving-traffic" | "walking".
export async function getRoute(points, profile = "driving-traffic") {
  const key = `${profile}:${points.map((p) => p.map((n) => n.toFixed(5)).join(",")).join(";")}`;
  if (cache.has(key)) return cache.get(key);
  if (!TOKEN) return estimate(points, profile);
  try {
    const params = new URLSearchParams({ geometries: "geojson", overview: "full", steps: "true", language: "en", access_token: TOKEN });
    const res = await fetch(`${BASE}/${profile}/${points.map((p) => p.join(",")).join(";")}?${params}`);
    if (!res.ok) throw new Error(`directions_${res.status}`);
    const route = parseRoute(await res.json());
    cache.set(key, route);
    return route;
  } catch {
    return estimate(points, profile);
  }
}

// The route for these points, or null while it loads. Pass null points to skip.
export function useRoute(points, profile = "driving-traffic") {
  const key = points ? JSON.stringify([profile, points]) : null;
  const [state, setState] = useState({ key: null, route: null });
  useEffect(() => {
    if (!key) return;
    let alive = true;
    const [p, pts] = JSON.parse(key);
    getRoute(pts, p).then((route) => alive && setState({ key, route }));
    return () => {
      alive = false;
    };
  }, [key]);
  return state.key === key ? state.route : null;
}

// The host's own route (start → office) and where you join it: the route point closest to you.
// Returns null while loading, else { route, meet, toMeet, fromMeet } where each part is { coords, km, minutes }.
export function useMeetRoute(start, drop, me) {
  const route = useRoute(start && drop ? [start, drop] : null);
  const meLng = me?.[0];
  const meLat = me?.[1];
  return useMemo(() => {
    if (!route || meLng == null) return null;
    const i = nearestIndex(route.coords, [meLng, meLat]);
    const part = (coords) => {
      const safe = coords.length > 1 ? coords : [coords[0], coords[0]];
      const k = lengthKm(safe);
      return { coords: safe, km: k, minutes: route.km ? (route.minutes * k) / lengthKm(route.coords) : 0 };
    };
    return { route, meet: route.coords[i], toMeet: part(route.coords.slice(0, i + 1)), fromMeet: part(route.coords.slice(i)) };
  }, [route, meLng, meLat]);
}

// "8:42 AM" for now + minutes.
export function arriveAt(minutes, now = new Date()) {
  const t = new Date(now.getTime() + minutes * 60000);
  const h = t.getHours() % 12 || 12;
  return `${h}:${String(t.getMinutes()).padStart(2, "0")} ${t.getHours() < 12 ? "AM" : "PM"}`;
}

// "8:42" + 25 min -> "9:07" (12-hour clock, no AM/PM; for times shown next to a stop).
export function clockPlus(hhmm, minutes) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + Math.round(minutes);
  return `${Math.floor(total / 60) % 12 || 12}:${String(total % 60).padStart(2, "0")}`;
}

// 350 m / 1.2 km
export const walkLabel = (k) => (k < 1 ? `${Math.round((k * 1000) / 10) * 10} m` : `${k.toFixed(1)} km`);
