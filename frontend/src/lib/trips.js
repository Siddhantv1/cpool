// Ride state on this phone (bookings as a guest, published ride and requests as a host).
// shortcut: kept in memory and filled with example data, replace with API calls + push updates when the backend is ready.
import { useEffect, useState } from "react";
import { playAlert } from "./alerts";
import { ALERTS, HOME, HOSTS, OFFICES, REQUESTS } from "./mock";

let state = {
  booking: null, // guest: { host, status: "requested" | "accepted" | "declined" | "cancelled" (by host) | "withdrawn" (by you), reason }
  published: null, // host: { from, to, when }
  requests: [], // host: pending seat requests
  passenger: null, // host: accepted request (shown as "Next ride")
  // Alerts tab, newest first: { id, kind, title, text, at, read, who?: { initials, color }, reqId? }
  alerts: ALERTS.map((a) => ({ ...a, at: Date.now() - a.minsAgo * 60000, read: true })),
  saved: { home: HOME, office: OFFICES[0] }, // Account → Saved places
  places: { pickup: null, from: HOME, to: OFFICES[0] }, // chosen places { name, area, coords }; pickup null = current location
};
const listeners = new Set();

export const getTrips = () => state;
function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
// Re-renders the screen whenever ride state changes.
export function useTrips() {
  const [trips, setTrips] = useState(state);
  useEffect(() => subscribe(setTrips), []);
  return trips;
}
function set(changes) {
  state = { ...state, ...changes };
  listeners.forEach((fn) => fn(state));
}

// Every Cpool trip starts or ends at a Perficient office.
export const isOffice = (p) => !!p && OFFICES.some((o) => o.id === p.id || o.name === p.name);

// "Home · Electronic City" for home, otherwise the place name.
export const placeName = (p) => (p.id === "home" ? `Home · ${p.area}` : p.name);
// key: "pickup" | "from" | "to" for a ride, or "home" | "office" for saved places.
export function setPlace(key, place) {
  if (key === "office") return set({ saved: { ...state.saved, office: place } });
  if (key !== "home") return set({ places: { ...state.places, [key]: place } });
  const home = { id: "home", name: "Home", area: place.id === "home" ? place.area : place.name, coords: place.coords };
  // Rides that start or end at home follow the new address.
  const follow = (p) => (p.id === "home" ? home : p);
  set({ saved: { ...state.saved, home }, places: { ...state.places, from: follow(state.places.from), to: follow(state.places.to) } });
}
export const swapRoute = () => set({ places: { ...state.places, from: state.places.to, to: state.places.from } });

export const hostById = (id) => HOSTS.find((h) => h.id === id);

let nextAlert = 0;
const alert = (kind, title, text, extra) => ({ id: `n${++nextAlert}`, kind, title, text, at: Date.now(), read: false, ...extra });
const first = (name) => name.split(" ")[0];
export const markRead = (id) => set({ alerts: state.alerts.map((a) => (id === undefined || a.id === id ? { ...a, read: true } : a)) });
export const removeAlert = (id) => set({ alerts: state.alerts.filter((a) => a.id !== id) });
const hostWho = (h) => ({ initials: h.initials, color: h.color });
const guestWho = (r) => ({ initials: r.initials, color: "#7C3AED" });

// ----- guest -----
let answerTimer = null;
export function bookRide(hostId) {
  set({ booking: { host: hostById(hostId), status: "requested", at: Date.now() } });
  // shortcut: the example host accepts after 8 s; really the answer arrives as a push notification from the backend.
  answerTimer = setTimeout(() => {
    acceptBooking();
    playAlert("accepted");
  }, 8000);
}
function setBooking(status, kind, title, text, reason) {
  if (!state.booking) return;
  clearTimeout(answerTimer);
  set({ booking: { ...state.booking, status, reason }, alerts: [alert(kind, title, text, { who: hostWho(state.booking.host), cta: ["declined", "cancelled"].includes(status) ? "find" : undefined }), ...state.alerts] });
}
const acceptBooking = () =>
  state.booking && setBooking("accepted", "accepted", `${first(state.booking.host.name)} accepted your request`, `Tomorrow ${state.booking.host.time} AM · pickup at HSR Layout`);
export const declineBooking = () =>
  state.booking && setBooking("declined", "declined", `${first(state.booking.host.name)} couldn't take you`, "Your seat request was declined. Try another ride.");
export const cancelBooking = () =>
  state.booking && setBooking("cancelled", "cancelled", `${first(state.booking.host.name)} cancelled your ride`, "Plans changed. Find another ride for this trip.", "Plans changed");
// You cancel: a pending request (withdraw) or an accepted ride with a reason.
export function withdrawBooking(reason) {
  if (!state.booking) return;
  const wasAccepted = state.booking.status === "accepted";
  setBooking("withdrawn", "cancelled", wasAccepted ? `You cancelled your ride with ${first(state.booking.host.name)}` : "You withdrew your seat request", reason ?? "Request withdrawn", reason);
}
export function clearBooking() {
  clearTimeout(answerTimer);
  set({ booking: null });
}

// ----- host -----
export function publishRide(ride) {
  set({ published: ride, requests: [] });
}
// Example: colleagues' requests come in shortly after publishing.
export const receiveRequests = () =>
  set({ requests: REQUESTS, alerts: [...REQUESTS.map((r) => alert("request", `${first(r.name)} asked for a seat`, `${r.pickupTime} · pickup at ${r.pickup} · ${r.rides} rides`, { reqId: r.id, who: guestWho(r) })), ...state.alerts] });
export function answerRequest(id, accept) {
  const req = state.requests.find((r) => r.id === id);
  set({ requests: state.requests.filter((r) => r.id !== id), passenger: accept ? req : state.passenger });
}
export function cancelPublished() {
  if (!state.published) return;
  const text = state.passenger ? `${first(state.passenger.name)} has been told` : "No one had booked yet";
  set({ published: null, passenger: null, requests: [], alerts: [alert("cancelled", `You cancelled your ride · ${state.published.when}`, text, state.passenger ? { who: guestWho(state.passenger) } : {}), ...state.alerts] });
}
export const finishHosting = () => set({ published: null, passenger: null, requests: [] });
