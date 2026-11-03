// Who is signed in right now: { email, token, role: "guest" | "host" | null, vehicle, name, gender, photo, phone: "+91…" }.
// Saved in the phone's encrypted storage (Android Keystore / iOS Keychain), so closing the app or clearing it from
// recents keeps you signed in. Sign out (or a login the server no longer accepts) clears it.
import * as SecureStore from "expo-secure-store";

const KEY = "cpool.session";

function load() {
  try {
    return JSON.parse(SecureStore.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
}
let current = load();

function save(session) {
  current = session;
  try {
    // Written synchronously ("null" when signed out), so a quick sign-out then sign-in can't land out of order.
    SecureStore.setItem(KEY, JSON.stringify(session));
  } catch {}
  return session;
}

export const getSession = () => current;
export const setSession = (session) => save(session);
export const updateSession = (changes) => save({ ...current, ...changes });
export const clearSession = () => save(null);

// The name set in Edit profile, else one made from the email: "aswin.v@perficient.com" -> "Aswin V".
export const displayName = (s) =>
  s.name ?? s.email.split("@")[0].split(/[._-]/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
