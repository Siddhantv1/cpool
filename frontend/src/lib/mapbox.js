// Mapbox setup shared by every map screen.
// The public token (pk.…) comes from .env as EXPO_PUBLIC_MAPBOX_TOKEN; never put a token in the code (the repo is public).
import Mapbox from "@rnmapbox/maps";
import * as SecureStore from "expo-secure-store";

const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";
export const hasMapboxToken = token.startsWith("pk.");
if (hasMapboxToken) Mapbox.setAccessToken(token);

// Mapbox telemetry (anonymous map usage sent to Mapbox): on unless turned off in Account. Our maps hide Mapbox's (i)
// button, whose dialog had this switch, so Mapbox asks for it somewhere in the app.
const TELEMETRY_OFF = "cpool.mapTelemetryOff";
export function mapTelemetryOn() {
  try {
    return SecureStore.getItem(TELEMETRY_OFF) !== "1";
  } catch {
    return true;
  }
}
export function setMapTelemetry(on) {
  try {
    SecureStore.setItem(TELEMETRY_OFF, on ? "0" : "1");
  } catch {}
  if (hasMapboxToken) Mapbox.setTelemetryEnabled(on);
}
if (hasMapboxToken && !mapTelemetryOn()) Mapbox.setTelemetryEnabled(false);

// Navigation styles show street names and live traffic colours on the roads.
export const MAP_STYLES = { light: "mapbox://styles/mapbox/navigation-day-v1", dark: "mapbox://styles/mapbox/navigation-night-v1" };
// Grey maps for a trip that isn't happening any more (Cancelled screen).
export const MUTED_STYLES = { light: "mapbox://styles/mapbox/light-v11", dark: "mapbox://styles/mapbox/dark-v11" };

// [west, south, east, north] -> Mapbox camera bounds
export const toBounds = ([w, s, e, n]) => ({ ne: [e, n], sw: [w, s] });
