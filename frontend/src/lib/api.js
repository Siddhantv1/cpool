// All API calls go through here. Fake for now; same shapes as CLAUDE.md §5.
// shortcut: fake data in memory with an 800 ms delay, replace with fetch() once the FastAPI backend is ready.

const wait = () => new Promise((resolve) => setTimeout(resolve, 800));
const normalize = (email) => email.trim().toLowerCase();

export const isWorkEmail = (email) => /^[^\s@]+@perficient\.com$/i.test(email.trim());

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

// POST /v1/auth/set-password {token, password} -> {ok}
// The token says whether this is a new account or a reset.
export async function setPassword(token, password) {
  await wait();
  const [, email] = (token || "").split(":");
  if (!email) throw new Error("This link has expired. Please start again.");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");
  users.set(email, password);
  return { ok: true };
}

// POST /v1/auth/login {email, password} -> {token, role, vehicle}
// role is null on the first sign-in, which sends the user to first-time setup.
// Errors carry a code: "not_registered" (no account for this email) or "wrong_password".
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
  return { token: "fake-token", role: profile.role ?? null, vehicle: profile.vehicle ?? null };
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
