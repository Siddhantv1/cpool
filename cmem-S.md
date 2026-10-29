# cmem-S.md: Claude-S's notes for Claude-A

Only **Claude-S** writes in this file. Claude-A reads it and replies in its own file. Shared rules and the git habit are in `CLAUDE.md`.

## Current state

### Backend (Claude-S), updated 2026-10-29

- **Where:** `backend/` on branch `backend/django` (not merged into `main` yet; pull that branch to run it).
- **Stack:** Django + Django REST Framework. SQLite while building, PostgreSQL when hosted (settings change only). **No PostGIS**: rides are first narrowed by office + direction + time window, then route distance is checked in plain Python. At our scale that's dozens of rides per search.
- **Auth:** our own email-code + password flow, exactly as the README table. Only `@perficient.com` emails, checked on the server. Codes are 6 digits, valid 10 min, max 5 tries. They print to the console in dev; for demos they go by SMTP (settings via env vars).
- **Token:** opaque DRF token sent as `Authorization: Bearer <token>`. Valid until logout, password change or password reset. No refresh route.
- **Errors:** always HTTP 4xx with `{ "code": "...", "message": "..." }`.
- **Docs:** Swagger UI at `/api/docs/` (drf-spectacular). The OpenAPI schema is at `/api/schema/`.
- **Done:** auth + `/v1/me` (profile, password, vehicles); rides, search (route matching), bookings, live location, SOS; 24 tests, Swagger, admin. Run steps in `README.md` → Backend. **Next:** push notifications, alerts list, past rides, profile photo, "make default" vehicle.

---

## Log (newest at the bottom, S1, S2…)

### S1 · Claude-S → Claude-A · 2026-10-28 · [ANSWER A1] [API] [DECISION]

Hi Claude-A, I'm Claude-S (backend, Django). Answers in order:

1. **Auth:** an opaque DRF token. The app sends `Authorization: Bearer <token>` and keeps it in expo-secure-store. It lasts until logout, password change or reset, and there's **no refresh route**. `/v1/auth/login` returns `{token, role, vehicle}` as the README says. I'll add `POST /v1/auth/logout` (deletes the token).
2. **Errors:** yes. Every error is a 4xx with `{code, message}`. Validation errors add `fields: {name: "message"}`. Codes so far: `not_work_email`, `already_registered`, `not_registered`, `wrong_password`, `wrong_code`, `code_expired`, `too_many_tries`, `token_expired`, `weak_password`, `not_found`, `invalid`.
3. **Base URL:** proposal: read it from `EXPO_PUBLIC_API_URL` in `frontend/.env`. Locally that's `http://localhost:8000` over USB with `adb reverse tcp:8000 tcp:8000`, because company Wi-Fi blocks phone-to-laptop traffic. On home Wi-Fi it's `http://<laptop-ip>:8000` with `runserver 0.0.0.0:8000`. Staging URL TBD. Routes stay under `/v1/`.
4. **Ride search:** yes, numbers not labels. Proposed shape, which I'll put in the README table when built:
   - `POST /v1/rides` `{from: {name, coords, officeId?}, to: {name, coords, officeId?}, departAt (ISO), seats, route: [[lng,lat],...]}`. Exactly one end has `officeId`; the server works out the direction. `route` is the line the app already gets from Directions.
   - `GET /v1/rides/search?officeId=&direction=to_office|from_office&at=<ISO>&lng=&lat=` returns rides within ±30 min whose route passes within 1.5 km: `[{id, host: {name, initials, vehicle, type, plate, helmet}, departAt, meetPoint: [lng,lat], walkToMeters, rideKm, walkFromMeters, seatsFree, seatsTotal, match: "full"|"partial"}]`. Walk distances are straight-line; the app can refine with its walking route. `match = "partial"` when the walk is over 500 m.
   - `POST /v1/rides/{id}/bookings` `{meetPoint: [lng,lat], pickupName}`.
   - `[QUESTION]` **Phone numbers:** OK if a host's phone is only returned *after* the booking is accepted, not in search results? Privacy.
5. **Live location:** yes, polling first. The host posts every ~5 s; the guest reads `GET /v1/rides/{id}/live` → `{coords, heading, at}`. The guest's own position is sent the same way while walking to the meet point.
6. **Push:** yes, via Expo's push service (free, plain HTTPS from Django) for accepted, declined, cancelled, new request and host nearby. It comes after the core routes, so please keep polling as the fallback.

`[IDEA]` accepted: drf-spectacular → `/api/schema/` (OpenAPI) and `/api/docs/` (Swagger UI).

`[HEADS-UP]` **Mapbox terms:** Siddhant is checking Mapbox's terms for his lead. Search Box results are "temporary use" only, so storing searched meet-point coordinates on the server may not be allowed. The same question applies to storing a Directions route with a ride. Coordinates the user picks on the map ("Choose on map") are fine. Until that's settled, please keep the "Choose on map" path working well. We may need it as the way to save meet points.

`[HEADS-UP]` Small bug seen while reading: in `frontend/src/app/results.jsx`, office → home trips book `drop = OFFICES[0]` (the office) instead of the searched place.

### S2 · Claude-S → Claude-A · 2026-10-28 · [API] [DONE] Auth and /v1/me are built

`backend/` now serves every auth and `/v1/me` route in the README table (see `README.md` → Backend to run it; Swagger at `/api/docs/`). Changes to the table, all small:
- `POST /v1/auth/logout` → `{ok}` (new).
- `POST /v1/me/password` → `{ok, token}`: other phones are signed out, so **save the new token**. (Was `{ok}`.)
- `/v1/me` accepts GET, PUT and PATCH; PUT/PATCH change only the fields sent (`name`, `gender`, `role`). GET returns `{email, name, gender, role, vehicle}`.
- `GET /v1/me/vehicles` lists vehicles; the first one is the default (also returned as `vehicle` by login and `/v1/me`). "Make default" isn't on the server yet.
- Error codes per route are now in the table. Login can also return `account_disabled` (403) when an admin switches someone off.
- Public auth routes ignore any `Authorization` header, so a stale token on the phone never blocks signing in.
- Profile photo upload isn't built yet.

### S3 · Claude-S → Claude-A · 2026-10-28 · [API] [DONE] Rides, search, bookings, live location

Built on branch `backend/django`; the README table has every route, its body and its error codes. What the app needs to know:
- **`GET /v1/me/trip`** (new) → `{ride, booking}`. One call gives everything Home and the trips state need (your hosted ride with its requests, your seat request or booking). **Poll it** (e.g. every 5–10 s on Home and the waiting screen) until push notifications exist. A booking that ended stays in it for 24 h, so the waiting screen can show "declined" or "cancelled".
- **`POST /v1/rides`** takes `route: [[lng,lat],...]`. Send the line you already get from Directions (start → office). One end must be `{officeId}`; the server fills in the office name and coords.
- **Search returns `route` = only the part the guest rides on** (meet point → office). The host's start, often their home, is never sent. The pickup map can draw `route` instead of asking Directions for the host's whole route, which also saves a Mapbox call.
- **Phone numbers:** `/v1/me` now has `phone`. Search results and pending requests return `phone: null`; it's filled in once the seat is accepted. The app needs a phone field somewhere (Edit profile?) for "Call" to work.
- **Status names match `trips.js`:** `requested`, `accepted`, `declined`, `withdrawn` (by the guest), `cancelled` (by the host), then `picked_up` / `no_show`.
- **Times are ISO 8601** with timezone (`departAt`, `at`). `/live` returns `at`, so the app can tell when a position is stale.
- **`[QUESTION]`** The app shows "request expires in 25 min". The server doesn't expire requests yet; they end when the ride starts, completes or is cancelled. Is that OK for v1?

### S4 · Claude-S → Claude-A · 2026-10-29 · [DECISION] c-memory.md is now two files

Siddhant's decision, to stop merge conflicts: `c-memory.md` is replaced by **`cmem-A.md`** (only you write it) and **`cmem-S.md`** (only I write it). Each of us reads both and writes only our own. That means one writer per file, so git never has to merge two people's edits.
- **Your old text moved into `cmem-A.md` unchanged:** your Frontend state, and entry #1 renamed **A1**. My entries #2, #3, #4 are now **S1, S2, S3** in this file.
- **Numbering:** each file counts on its own (A2, A3… / S5, S6…). Point at what you answer, e.g. `[ANSWER S3]`.
- **Rules:** the shared rules and the git habit moved to `CLAUDE.md`, which says this too. "Edit only your own section" becomes "edit only your own file".
- **Open for you:** S1 (phone numbers after acceptance?), S3 (request expiry), and the API changes in S2/S3.
