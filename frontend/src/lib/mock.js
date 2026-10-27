// Example data for Bengaluru until the FastAPI backend is ready.
// Coordinates are [longitude, latitude].

export const OFFICES = [
  { id: "bellandur", name: "Perficient Bellandur", tag: "New office", short: "Bellandur", coords: [77.6914, 12.9307] },
  { id: "whitefield", name: "Perficient Whitefield", tag: "Old office", short: "Whitefield", coords: [77.73, 12.985] },
];

export const HOME = { id: "home", name: "Home", area: "Electronic City", coords: [77.6707, 12.8472] };

// Home (Electronic City) → HSR Layout → Agara → Perficient Bellandur.
export const ROUTE = [
  [77.6707, 12.8472], [77.664, 12.864], [77.656, 12.882], [77.648, 12.899],
  [77.645, 12.9116], [77.652, 12.923], [77.67, 12.9285], [77.6914, 12.9307],
];
export const PICKUP_INDEX = 4; // HSR Layout · 27th Main (guest's pickup)
export const AGARA_INDEX = 5; // Agara junction (Rahul's pickup when you host)
// Where the guest stands before walking to the pickup (about 350 m away), with the walking path.
export const WALK_TO_PICKUP = [[77.6412, 12.9139], [77.6431, 12.9131], [77.645, 12.9116]];

export const PLACES = [
  { name: "Koramangala 5th Block", area: "Koramangala, Bengaluru", km: 4.1, coords: [77.619, 12.9345] },
  { name: "Koramangala Sony World signal", area: "80 Feet Rd, Koramangala", km: 3.6, coords: [77.626, 12.937] },
  { name: "Forum Mall, Koramangala", area: "Hosur Rd, Koramangala", km: 5.2, coords: [77.611, 12.9346] },
  { name: "HSR Layout · 27th Main", area: "HSR Layout, Bengaluru", km: 0.3, coords: [77.645, 12.9116] },
  { name: "Silk Board junction", area: "Hosur Rd, Bengaluru", km: 2.4, coords: [77.6233, 12.9172] },
  { name: "Agara junction", area: "Outer Ring Rd, Agara", km: 1.6, coords: [77.652, 12.923] },
  { name: "Electronic City Phase 1", area: "Electronic City, Bengaluru", km: 8.9, coords: [77.6707, 12.8472] },
  { name: "Marathahalli bridge", area: "Outer Ring Rd, Marathahalli", km: 9.4, coords: [77.701, 12.956] },
];

export const HOSTS = [
  { id: "h1", initials: "PR", color: "#1D4ED8", name: "Priya R.", phone: "+919840012345", vehicle: "White Hyundai i20", type: "car", plate: "KA 05 MX 2231",
    time: "8:42", walkTo: "350 m", ride: "12.4 km", walkFrom: "60 m", seatsFree: 2, seatsTotal: 3, match: "Full match", full: true },
  { id: "h2", initials: "AK", color: "#B45309", name: "Arun K.", phone: "+919845012345", vehicle: "Bajaj Pulsar 150", type: "bike", plate: "KA 01 HX 8812",
    time: "8:50", walkTo: "120 m", ride: "11.8 km", walkFrom: "0 m", seatsFree: 1, seatsTotal: 1, helmet: true, match: "Full match", full: true },
  { id: "h3", initials: "SN", color: "#0F766E", name: "Sneha N.", phone: "+919880012345", vehicle: "Silver Honda City", type: "car", plate: "KA 03 MN 7788",
    time: "9:05", walkTo: "900 m", ride: "10.2 km", walkFrom: "400 m", seatsFree: 3, seatsTotal: 4, match: "Partial match · longer walk", full: false },
];

// Seat requests that arrive after you publish a ride (as a host).
export const REQUESTS = [
  { id: "r1", initials: "RV", name: "Rahul V.", phone: "+919900012345", rides: 24, pickup: "Agara junction", pickupTime: "8:38 AM",
    walk: "450 m", drop: "Perficient Bellandur", dropTime: "9:15 AM", together: "6.2 km", detour: "+3 min", seats: 1, expiresIn: "25 min" },
  { id: "r2", initials: "DK", name: "Divya K.", phone: "+919911012345", rides: 9, pickup: "HSR Layout · 27th Main", pickupTime: "8:45 AM",
    walk: "200 m", drop: "Perficient Bellandur", dropTime: "9:15 AM", together: "5.4 km", detour: "+1 min", seats: 1, expiresIn: "28 min" },
];

// Older alerts shown under "Earlier" (minutes ago).
export const ALERTS = [
  { id: "a1", kind: "accepted", title: "Priya accepted your request", text: "Mon 8:42 AM · pickup at HSR Layout", minsAgo: 26 * 60, who: { initials: "PR", color: "#1D4ED8" } },
  { id: "a2", kind: "request", title: "Rahul asked for a seat", text: "Fri 6:00 PM · pickup at Agara junction", minsAgo: 4 * 24 * 60, who: { initials: "RV", color: "#7C3AED" } },
  { id: "a3", kind: "cancelled", title: "Karthik cancelled Monday's ride", text: "Your other requests stayed open", minsAgo: 5 * 24 * 60, who: { initials: "KS", color: "#0E7490" } },
];

export const PAST_RIDES = [
  { id: "p1", when: "Mon 26 Oct · 8:40 AM", from: "HSR Layout", to: "Perficient Bellandur", with: "Priya R.", role: "guest" },
  { id: "p2", when: "Fri 23 Oct · 6:05 PM", from: "Perficient Bellandur", to: "Electronic City", with: "Rahul V.", role: "host" },
];
