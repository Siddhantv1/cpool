// Dates and times for "When" when offering a ride.
const DAY = 24 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Today plus the next 6 days (rides can be offered up to a week ahead).
export const nextDays = (now = new Date()) => Array.from({ length: 7 }, (_, i) => new Date(startOfDay(now).getTime() + i * DAY));

// "Today" | "Tomorrow" | "Thu 29 Oct"
export function dayLabel(day, now = new Date()) {
  const diff = Math.round((startOfDay(day) - startOfDay(now)) / DAY);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `${WEEKDAYS[day.getDay()]} ${day.getDate()} ${MONTHS[day.getMonth()]}`;
}

// "8:30 AM"
export function timeLabel(d) {
  const h = d.getHours() % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() < 12 ? "AM" : "PM"}`;
}

export const whenLabel = (d, now = new Date()) => `${dayLabel(d, now)} · ${timeLabel(d)}`;

// Default for a new ride: tomorrow 8:30 AM.
export const defaultWhen = (now = new Date()) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 8, 30);

// "now" | "5 min" | "3 h" | "Yesterday" | "4 d" for the Alerts list.
export function ago(at, now = Date.now()) {
  const mins = Math.floor((now - at) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins} min`;
  if (mins < 24 * 60) return `${Math.floor(mins / 60)} h`;
  if (mins < 48 * 60) return "Yesterday";
  return `${Math.floor(mins / (24 * 60))} d`;
}

// Times near a "Tomorrow · 9:00 AM" label to suggest when no one is driving: [-30, +30, +60] minutes, same day.
export function nearbyTimes(label) {
  const m = /^(.*) · (\d{1,2}):(\d{2}) (AM|PM)$/.exec(label);
  if (!m) return [];
  const mins = ((Number(m[2]) % 12) + (m[4] === "PM" ? 12 : 0)) * 60 + Number(m[3]);
  return [-30, 30, 60]
    .map((d) => mins + d)
    .filter((t) => t >= 0 && t < 24 * 60)
    .map((t) => `${m[1]} · ${timeLabel(new Date(2000, 0, 1, Math.floor(t / 60), t % 60))}`);
}
