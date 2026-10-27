// Example data for Bengaluru until the Django backend is ready.
// Coordinates are [longitude, latitude]. Real roads between points come from the Mapbox Directions API (lib/directions.js).

export const OFFICES = [
  { id: "bellandur", name: "Perficient Bellandur", tag: "New office", short: "Bellandur", coords: [77.6914, 12.9307] },
  { id: "whitefield", name: "Perficient Whitefield", tag: "Old office", short: "Whitefield", coords: [77.73, 12.985] },
];

export const HOME = { id: "home", name: "Home", area: "BTM Layout 2nd Stage", coords: [77.6101, 12.9166] };

// Meet point used when your location is unknown and you haven't chosen a pickup.
export const MEET_POINT = { name: "Iblur junction", area: "Sarjapur Rd", coords: [77.6604, 12.9231] };

// Search results when there's no Mapbox token (a fresh clone of the repo).
export const PLACES = [
  { name: "Indiranagar 100 Feet Rd", area: "Indiranagar, Bengaluru", km: 7.6, coords: [77.6408, 12.9719] },
  { name: "Domlur flyover", area: "Old Airport Rd, Domlur", km: 6.4, coords: [77.6387, 12.961] },
  { name: "Kadubeesanahalli", area: "Outer Ring Rd, Bengaluru", km: 1.3, coords: [77.697, 12.939] },
  { name: "Wipro gate, Sarjapur Rd", area: "Sarjapur Rd, Bengaluru", km: 2.4, coords: [77.687, 12.91] },
  { name: "BTM Layout 2nd Stage", area: "BTM Layout, Bengaluru", km: 8.9, coords: [77.6101, 12.9166] },
  { name: "HSR BDA Complex", area: "HSR Layout, Bengaluru", km: 5.6, coords: [77.6387, 12.9116] },
  { name: "Marathahalli bridge", area: "Outer Ring Rd, Marathahalli", km: 2.9, coords: [77.701, 12.956] },
  { name: "Brookefield Mall", area: "ITPL Main Rd, Brookefield", km: 5.1, coords: [77.718, 12.969] },
];

// Hosts in "Find a ride". start / from = where their drive begins.
export const HOSTS = [
  { id: "h1", initials: "AM", color: "#BE185D", name: "Ananya M.", phone: "+919845011223", vehicle: "Red Maruti Swift", type: "car", plate: "KA 51 MJ 4410", start: [77.619, 12.9345], from: "Koramangala",
    time: "8:35", walkTo: "300 m", ride: "8.1 km", walkFrom: "80 m", seatsFree: 2, seatsTotal: 3, match: "Full match", full: true },
  { id: "h2", initials: "VS", color: "#1D4ED8", name: "Vikram S.", phone: "+919880044556", vehicle: "Royal Enfield Classic 350", type: "bike", plate: "KA 03 KL 7781", start: [77.6387, 12.961], from: "Domlur",
    time: "8:45", walkTo: "150 m", ride: "7.4 km", walkFrom: "0 m", seatsFree: 1, seatsTotal: 1, helmet: true, match: "Full match", full: true },
  { id: "h3", initials: "MJ", color: "#0F766E", name: "Meera J.", phone: "+919900077889", vehicle: "Grey Tata Nexon", type: "car", plate: "KA 53 MD 2205", start: [77.648, 12.918], from: "HSR Layout",
    time: "8:55", walkTo: "750 m", ride: "5.2 km", walkFrom: "350 m", seatsFree: 3, seatsTotal: 4, match: "Partial match · longer walk", full: false },
];

// Seat requests that arrive after you publish a ride (as a host). from = where the guest starts walking; coords = their pickup.
export const REQUESTS = [
  { id: "r1", initials: "KR", name: "Karthik R.", phone: "+919811022334", rides: 31, pickup: "Silk Board junction", coords: [77.6233, 12.9172], from: [77.6206, 12.9149], pickupTime: "8:32 AM",
    walk: "300 m", drop: "Perficient Bellandur", dropTime: "9:05 AM", together: "8.4 km", detour: "+2 min", seats: 1, expiresIn: "25 min" },
  { id: "r2", initials: "FS", name: "Fatima S.", phone: "+919822033445", rides: 12, pickup: "HSR BDA Complex", coords: [77.6387, 12.9116], from: [77.6361, 12.913], pickupTime: "8:40 AM",
    walk: "250 m", drop: "Perficient Bellandur", dropTime: "9:05 AM", together: "6.1 km", detour: "+3 min", seats: 1, expiresIn: "28 min" },
];

// Older alerts shown under "Earlier" (minutes ago).
export const ALERTS = [
  { id: "a1", kind: "accepted", title: "Ananya accepted your request", text: "Mon 8:35 AM · meet point near Koramangala", minsAgo: 26 * 60, who: { initials: "AM", color: "#BE185D" } },
  { id: "a2", kind: "request", title: "Karthik asked for a seat", text: "Fri 6:00 PM · pickup at Silk Board junction", minsAgo: 4 * 24 * 60, who: { initials: "KR", color: "#7C3AED" } },
  { id: "a3", kind: "cancelled", title: "Rohan cancelled Monday's ride", text: "Your other requests stayed open", minsAgo: 5 * 24 * 60, who: { initials: "RP", color: "#0E7490" } },
];

export const PAST_RIDES = [
  { id: "p1", when: "Mon 26 Oct · 8:35 AM", from: "Koramangala", to: "Perficient Bellandur", with: "Ananya M.", role: "guest" },
  { id: "p2", when: "Fri 23 Oct · 6:05 PM", from: "Perficient Bellandur", to: "BTM Layout", with: "Karthik R.", role: "host" },
];
