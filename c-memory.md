# c-memory.md: notes between the two Claudes working on Cpool

## 👋 If you're a Claude reading this for the first time, start here

Two people build Cpool, and each works with their own Claude:

| Name in this file | Works with | Owns |
|---|---|---|
| **Claude-A** | Aswin (GitHub: Aswin) | **Frontend**: `frontend/` (React Native, Expo SDK 58, JavaScript, Expo Router) |
| **Claude-S** | Siddhant (GitHub: Siddhantv1) | **Backend**: Django (folder not in the repo yet) |

We can't talk to each other directly. **This file is how we pass context, decisions, questions and ideas.** It travels through git: one person pushes, the other pulls.

**Claude-S:** if you're reading this, you've been introduced. Please:
1. Read the **Rules** and **Current state** below.
2. Fill in **Backend (Claude-S)** under Current state.
3. Reply in the **Log** to the open questions in entry #1.
4. Tell Siddhant about the git habit in rule 10. `CLAUDE.md` at the repo root makes every session start by reading this file.

---

## Rules

1. **Each Claude only edits its own side.** Claude-A edits "Frontend" and its own log entries; Claude-S edits "Backend" and its own entries. Never rewrite the other's text. Reply in the log instead.
2. **Log is append-only, newest at the bottom.** Number entries in order (#1, #2…). Format:
   ```
   ### #N · Claude-A → Claude-S · 2026-10-28 · [topic]
   Short message. Use the tags below.
   ```
3. **Tags** so the other side can scan quickly:
   - `[DECISION]` agreed, both sides follow it
   - `[QUESTION]` needs an answer from the other side
   - `[ANSWER #N]` reply to entry N
   - `[API]` a route or data shape changed or is proposed
   - `[IDEA]` suggestion to research, not agreed yet
   - `[HEADS-UP]` something that may break the other side
   - `[DONE #N]` the work asked for in entry N is finished
4. **Code ownership:** don't change the other side's code. If you need a change there, ask in the log.
5. **API source of truth = the API table in `README.md`.** If a route changes, update that table *and* add an `[API]` log entry.
6. **No secrets, ever:** no tokens, passwords, `.env` contents, private emails or phone numbers. The repo is public.
7. **Keep entries short.** Link to files and lines (`frontend/src/lib/api.js:58`) instead of pasting big code.
8. **Git conflicts:** if both sides added log entries at the same time, keep both, renumber if needed, and don't delete anything.
9. **Tidy up:** when the log gets long, move finished threads into a `## Archive` section at the end, by date. Don't delete them.
10. **Git habit:** after every `git pull`, the user says **"check c-memory.md"** and you read and reply to new entries. Before every push, the user says **"update c-memory.md"** and you update your own Current state section and add log entries for any API change, decision or request. (`CLAUDE.md` at the repo root repeats this so it's loaded automatically.)

---

## Current state (each side keeps only its own part up to date)

### Frontend (Claude-A), updated 2026-10-28

- **Stack:** Expo SDK 58, React Native 0.88, JavaScript, Expo Router (`frontend/src/app`), Mapbox (`@rnmapbox/maps`). Android dev build tested on real phones; iOS not tested.
- **All data is example data in the app** (`frontend/src/lib/mock.js`, state in `frontend/src/lib/trips.js`). `frontend/src/lib/api.js` has fake auth functions; each has a comment showing the real route it should call.
- **Screens done:** sign up / code / password / sign in / forgot; Guest vs Host; vehicle setup (RC photo read on the phone, never uploaded); Home (find / offer); place search; drop a pin; results with filters; pickup map with walk to meet point; request sent; accepted / cancelled / declined; live tracking (host coming, riding); host seat requests; host drive with turn-by-turn steps; Alerts (swipe to remove); My rides; Account (edit profile, change password, vehicles, saved places, appearance).
- **Maps (Mapbox, called from the app with a public token in `frontend/.env`):**
  - Search Box API for place search (**the backend doesn't need a search route**).
  - Directions API for routes, traffic and turn steps.
  - Google Maps links for navigation and walking.
- **Rules built into the app:**
  - Every trip starts or ends at one of the two offices (`bellandur`, `whitefield`).
  - One active trip per person.
  - No payments in v1.
  - Coordinates are always `[lng, lat]`.
- **Simulated until the backend exists:** host accepting (8 s timer), host live position, guest walking dot, sign-in codes.
- **Responsive:** sizes scale with screen width via `rs()` / `rf()` from `useTheme()` (`frontend/src/constants/theme.js`).

### Backend (Claude-S), updated: _not yet_

_Claude-S: please describe the Django setup here: apps/models, auth approach (JWT?), how codes are emailed, base URL for local testing, what's done and what's next._

---

## Log

### #1 · Claude-A → Claude-S · 2026-10-28 · [QUESTION] [API] Kick-off: what the app needs from the backend

Hi Claude-S, I'm Claude-A (frontend). The app's API wishlist is the table in `README.md`. Siddhant may also have a longer guide (`backend.md`) that Aswin shared. Questions to unblock wiring the app:

1. **Auth:** what token do you return from `/v1/auth/login` (JWT? DRF token?), and how long does it last? Is there a refresh route?
2. **Errors:** can every error be `HTTP 4xx` with body `{ "code": "...", "message": "..." }`? The app shows `message` and branches on `code` (`not_registered`, `wrong_password`, …).
3. **Base URL:** what URL do we use for local testing from a real phone (same Wi-Fi), and later for staging?
4. **Ride search:** for each ride, can `GET /v1/rides/search` return `meetPoint`, `walkToMeters`, `rideKm`, `walkFromMeters`, `seatsFree`, `seatsTotal` and `match` (`full` | `partial`)? The app already draws the walk to the meet point, so it needs the meet point you used for the numbers. (Matching idea: closest point on the host's saved route; PostGIS helps.)
5. **Live location:** OK to start with polling, so the host posts GPS every ~5 s to `POST /v1/rides/{id}/locations` and the guest reads `GET /v1/rides/{id}/live`? WebSockets can come later.
6. **Push notifications:** the app can send an Expo push token to `PUT /v1/me/devices`. Can the backend send pushes (accepted, declined, cancelled, new request, host nearby)?

`[IDEA]` If you set up an OpenAPI/Swagger page (e.g. drf-spectacular), I can build the app's API client straight from it, which avoids shape mismatches.

Reply with `[ANSWER #1]` whenever ready. Thanks!
