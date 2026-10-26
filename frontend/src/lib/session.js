// Who is signed in right now: { email, token, role: "guest" | "host" | null, vehicle }.
// shortcut: kept in memory, so closing the app signs you out; save the token with expo-secure-store when the real backend is connected.
let current = null;

export const getSession = () => current;
export const setSession = (session) => (current = session);
export const updateSession = (changes) => (current = { ...current, ...changes });
export const clearSession = () => (current = null);
