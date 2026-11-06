// All API calls go through here; shapes follow the API table in README.md.
// Sign-in, profile, vehicles and delete account call the Django backend (EXPO_PUBLIC_API_URL). Rides are still example data.

import { router } from "expo-router";
import { HOSTS, PLACES } from "./mock";
import { clearSession, getSession, updateSession } from "./session";

const wait = () => new Promise((resolve) => setTimeout(resolve, 800));
const normalize = (email) => email.trim().toLowerCase();
const API = process.env.EXPO_PUBLIC_API_URL ?? "";
const TIMEOUT_MS = 15000;

export const isWorkEmail = (email) => /^[^\s@]+@perficient\.com$/i.test(email.trim());
// Indian mobile number typed without +91: 10 digits starting with 6–9.
export const isMobile = (digits) => /^[6-9]\d{9}$/.test(digits);

// One request to the backend. Its errors are {code, message}: thrown as an Error with .code (and .fields for bad input),
// so screens show message and branch on code. Signed-in calls send the session's token.
async function call(path, { method = "POST", body, auth = false } = {}) {
  const token = auth ? getSession()?.token : null;
  // React Native on Android has no time limit of its own: an unreachable server (asleep laptop, wrong Wi-Fi address)
  // kept the spinner going for minutes. Give up after 15 s and show the network message instead.
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  let res;
  let data;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: abort.signal,
    });
    data = await res.json().catch(() => null);
  } catch {
    throw Object.assign(new Error("Can’t reach Cpool. Check your internet and try again."), { code: "network" });
  } finally {
    clearTimeout(timer);
  }
  // 401 = the saved login no longer works (signed out on another phone, password changed, account deleted).
  if (auth && res.status === 401) {
    clearSession();
    router.replace({ pathname: "/welcome", params: { notice: "You were signed out. Please sign in again." } });
  }
  // Every backend reply is JSON; anything else (e.g. EXPO_PUBLIC_API_URL missing, so the request hit Metro) is an error, never a fake success.
  if (!res.ok || !data) throw Object.assign(new Error(data?.message ?? "Something went wrong. Please try again."), { code: data?.code, fields: data?.fields });
  return data;
}

// POST /v1/auth/signup {email} -> sends a code. Errors: not_work_email, already_registered
export const signup = (email) => call("/v1/auth/signup", { body: { email: normalize(email) } });

// POST /v1/auth/forgot {email} -> sends a code (same answer whether or not the account exists)
export const forgotPassword = (email) => call("/v1/auth/forgot", { body: { email: normalize(email) } });

// POST /v1/auth/verify {email, code, purpose: "signup" | "reset"} -> {token}. Errors: wrong_code, code_expired, too_many_tries
export const verifyCode = (email, code, purpose) => call("/v1/auth/verify", { body: { email: normalize(email), code, purpose } });

// POST /v1/auth/set-password {token, password, phone, gender} -> {ok}. phone + gender only for a new account
// (10 digits, "Female" | "Male" | "Prefer not to say"); a reset token ignores them.
export const setPassword = (token, password, phone, gender) =>
  call("/v1/auth/set-password", { body: { token, password, ...(phone ? { phone } : {}), ...(gender ? { gender } : {}) } });

// POST /v1/auth/login {email, password} -> {token, role, vehicle, phone, gender}. role is null on the first sign-in.
// Errors: not_registered, wrong_password, account_disabled
export const login = (email, password) => call("/v1/auth/login", { body: { email: normalize(email), password } });

// POST /v1/auth/logout -> {ok}: the token stops working on the server.
export const logout = () => call("/v1/auth/logout", { auth: true });

// POST /v1/me/password {current, new} -> {ok, token}. Other phones are signed out, so this phone keeps the new token.
export async function changePassword(email, current, next) {
  const { token } = await call("/v1/me/password", { body: { current, new: next }, auth: true });
  updateSession({ token });
  return { ok: true };
}

// PATCH /v1/me {role: "guest" | "host"} -> your profile
export const setRole = (email, role) => call("/v1/me", { method: "PATCH", body: { role }, auth: true });

// POST /v1/me/vehicles {type, number, model, mfgMonth, mfgYear, colour, seats, helmet}. The RC photo is never uploaded;
// only the details read from it. Error: vehicle_exists when the plate is already on Cpool.
export const addVehicle = (email, vehicle) => call("/v1/me/vehicles", { body: vehicle, auth: true });

// POST /v1/me/delete {password} -> {ok}. Errors: wrong_password, already_on_trip
export const deleteAccount = (email, password) => call("/v1/me/delete", { body: { password }, auth: true });

// ---------- Rides (example data until the backend is ready) ----------

// ---- Place search: Mapbox Search Box API (suggest while typing, retrieve coordinates when chosen) ----
// Uses the public token from .env. Only the typed text and an approximate point to rank by distance are sent.
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";
const SEARCH = "https://api.mapbox.com/search/searchbox/v1";
const BENGALURU = [77.5946, 12.9716];
const BENGALURU_BOX = "77.30,12.70,77.95,13.25";

// Groups the suggest + retrieve calls of one search into a single billed session (Mapbox asks for a UUID).
export const newSearchSession = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });

// Places matching the text, nearest first: [{ name, area, km, mapboxId }]. near = [lng, lat] of the user, if known.
export async function searchPlaces(q, { session, near } = {}) {
  const query = q.trim();
  if (query.length < 2) return [];
  if (!MAPBOX_TOKEN) {
    // No token (fresh clone): fall back to the example places.
    const lower = query.toLowerCase();
    return PLACES.filter((p) => p.name.toLowerCase().includes(lower) || p.area.toLowerCase().includes(lower)).slice(0, 5);
  }
  const at = (near ?? BENGALURU).join(",");
  const params = new URLSearchParams({
    q: query,
    access_token: MAPBOX_TOKEN,
    session_token: session,
    language: "en",
    country: "in",
    limit: "8",
    proximity: at,
    origin: at,
    bbox: BENGALURU_BOX,
    types: "poi,address,street,neighborhood,locality,place",
  });
  const res = await fetch(`${SEARCH}/suggest?${params}`);
  if (!res.ok) throw new Error(`search_failed_${res.status}`);
  const { suggestions = [] } = await res.json();
  return suggestions.map((s) => ({
    name: s.name,
    area: s.place_formatted || s.full_address || "",
    km: typeof s.distance === "number" ? Math.round(s.distance / 100) / 10 : null,
    mapboxId: s.mapbox_id,
  }));
}

// Coordinates for a chosen suggestion: { ...place, coords: [lng, lat] }.
export async function retrievePlace(place, session) {
  if (place.coords || !place.mapboxId) return place;
  const params = new URLSearchParams({ access_token: MAPBOX_TOKEN, session_token: session });
  const res = await fetch(`${SEARCH}/retrieve/${encodeURIComponent(place.mapboxId)}?${params}`);
  if (!res.ok) throw new Error(`retrieve_failed_${res.status}`);
  const { features = [] } = await res.json();
  const coords = features[0]?.geometry?.coordinates;
  if (!coords) throw new Error("retrieve_no_coords");
  return { ...place, coords };
}

// GET /v1/rides/search?office=&direction=&at= → hosts whose route passes near your pickup
export async function searchRides(officeId) {
  await wait();
  // shortcut: no example rides go to Whitefield, so the "no rides yet" screen can be seen; the backend returns real matches.
  // Full rides are never offered to guests (the backend must filter them too).
  return (officeId === "whitefield" ? [] : HOSTS).filter((h) => h.seatsFree > 0);
}
