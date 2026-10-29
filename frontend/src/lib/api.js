// All API calls go through here. Fake for now; same shapes as the API table in README.md.
// shortcut: fake data in memory with an 800 ms delay, replace with fetch() once the Django backend is ready.

import { HOSTS, PLACES } from "./mock";

const wait = () => new Promise((resolve) => setTimeout(resolve, 800));
const normalize = (email) => email.trim().toLowerCase();

export const isWorkEmail = (email) => /^[^\s@]+@perficient\.com$/i.test(email.trim());
// Indian mobile number typed without +91: 10 digits starting with 6–9.
export const isMobile = (digits) => /^[6-9]\d{9}$/.test(digits);

// Fake accounts: email -> password. Demo account for testing login without signing up.
const users = new Map([["demo@perficient.com", "Cpool123"]]);
// Fake profiles: email -> { role, vehicle }. Empty until first-time setup is done.
const profiles = new Map();
const FAKE_CODE = "123456";

function checkEmail(email) {
  if (!isWorkEmail(email)) throw new Error("Use your perficient email.");
}

// POST /v1/auth/signup {email} -> sends a code to the email
export async function signup(email) {
  await wait();
  checkEmail(email);
  if (users.has(normalize(email))) throw new Error("An account with this email already exists. Sign in instead");
  return { ok: true };
}

// POST /v1/auth/forgot {email} -> sends a code to the email
// The real backend answers the same whether or not the account exists, so nobody can probe for accounts.
export async function forgotPassword(email) {
  await wait();
  checkEmail(email);
  return { ok: true };
}

// POST /v1/auth/verify {email, code, purpose: "signup" | "reset"} -> {token}
export async function verifyCode(email, code, purpose) {
  await wait();
  if (code !== FAKE_CODE) throw new Error("That code is wrong. Check your email and try again.");
  return { token: `${purpose}:${normalize(email)}` };
}

// POST /v1/auth/set-password {token, password, phone} -> {ok}   (phone only for a new account, e.g. "+919876543210")
// The token says whether this is a new account or a reset. A new account needs a mobile number.
export async function setPassword(token, password, phone) {
  await wait();
  const [purpose, email] = (token || "").split(":");
  if (!email) throw new Error("This link has expired. Please start again.");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");
  if (purpose === "signup") {
    if (!isMobile(phone ?? "")) throw new Error("Enter your 10-digit mobile number.");
    profiles.set(email, { ...profiles.get(email), phone: `+91${phone}` });
  }
  users.set(email, password);
  return { ok: true };
}

// POST /v1/auth/login {email, password} -> {token, role, vehicle, phone}
// role is null on the first sign-in, which sends the user to first-time setup.
// Errors carry a code: "not_registered" (no account for this email) or "wrong_password".
// POST /v1/me/password {current, new} → { ok }. Error if the current password is wrong.
export async function changePassword(email, current, next) {
  await wait();
  if (users.get(normalize(email)) !== current) throw new Error("Your current password is incorrect.");
  users.set(normalize(email), next);
  return { ok: true };
}

export async function login(email, password) {
  await wait();
  checkEmail(email);
  if (!users.has(normalize(email))) {
    throw Object.assign(new Error("No account found for this email."), { code: "not_registered" });
  }
  if (users.get(normalize(email)) !== password) {
    throw Object.assign(new Error("Email or password is incorrect"), { code: "wrong_password" });
  }
  const profile = profiles.get(normalize(email)) ?? {};
  return { token: "fake-token", role: profile.role ?? null, vehicle: profile.vehicle ?? null, phone: profile.phone ?? null };
}

// PUT /v1/me {role: "guest" | "host"} -> {ok}
export async function setRole(email, role) {
  await wait();
  profiles.set(normalize(email), { ...profiles.get(normalize(email)), role });
  return { ok: true };
}

// POST /v1/me/vehicles {type, number, model, mfgMonth, mfgYear, colour, seats, helmet} -> {ok}
// The RC photo is never uploaded; only the details read from it.
export async function addVehicle(email, vehicle) {
  await wait();
  profiles.set(normalize(email), { ...profiles.get(normalize(email)), vehicle });
  return { ok: true };
}

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
