// Mapbox setup shared by every map screen.
// The public token (pk.…) comes from .env as EXPO_PUBLIC_MAPBOX_TOKEN; never put a token in the code (the repo is public).
import Mapbox from "@rnmapbox/maps";

const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";
export const hasMapboxToken = token.startsWith("pk.");
if (hasMapboxToken) Mapbox.setAccessToken(token);

// Navigation styles show street names and live traffic colours on the roads.
export const MAP_STYLES = { light: "mapbox://styles/mapbox/navigation-day-v1", dark: "mapbox://styles/mapbox/navigation-night-v1" };

// [west, south, east, north] -> Mapbox camera bounds
export const toBounds = ([w, s, e, n]) => ({ ne: [e, n], sw: [w, s] });
