// Who is signed in right now: { email, token, role: "guest" | "host" | null, vehicle, name, gender, photo }.
// shortcut: kept in memory, so closing the app signs you out; save the token with expo-secure-store when the real backend is connected.
let current = null;

export const getSession = () => current;
export const setSession = (session) => (current = session);
export const updateSession = (changes) => (current = { ...current, ...changes });
export const clearSession = () => (current = null);

// The name set in Edit profile, else one made from the email: "aswin.v@perficient.com" -> "Aswin V".
export const displayName = (s) =>
  s.name ?? s.email.split("@")[0].split(/[._-]/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
