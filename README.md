# Cpool

Perficient's internal carpool app. Employees share rides between home and the office with verified colleagues.
Every ride starts or ends at a Perficient office (Bellandur or Whitefield), by car or bike.

- **Host:** offers a ride and the free seats in their vehicle.
- **Guest:** finds a ride going their way and requests a seat.

**Status:**
- **The app:** every screen is built, but it still shows example data until it is connected to the backend through `frontend/src/lib/api.js`.
- **The backend:** login, profile, vehicles, rides, search, bookings, live location, SOS, alerts, history and account deletion are built and tested.
- **Not built yet:** push notifications, profile photos, hosting.

## What's in this repo

| Path | What it is | Owner |
|---|---|---|
| `frontend/` | The Android/iOS app (Expo, React Native, JavaScript) | Aswin |
| `backend/` | The API server (Django + Django REST Framework) | Siddhant |
| `CLAUDE.md` | Rules for the two Claude assistants working on this repo | both |
| `cmem-A.md` · `cmem-S.md` | Notes between the frontend Claude (A) and the backend Claude (S). Each writes only its own file | A · S |

## How it works

- **Sign-up and login:** a 6-digit code to a `@perficient.com` email, then a password and a mobile number. No third-party login service.
- **Maps:**
  - The app draws maps with **Mapbox**.
  - It calls the Mapbox **Search Box API** for "Where to?" and the **Directions API** for road routes.
  - **Navigation** opens the Google Maps app.
  - Both Mapbox APIs are called from the app with a public token; the backend has no map routes.
- **Matching rides:** the backend narrows rides by office, direction and time (±30 min). It then finds the closest point on each host's route to the guest, in plain Python, and keeps rides within 1.5 km. That closest point is the meet point.
- **Rules the server enforces:**
  - one trip at a time per person
  - a seat can't be given twice
  - only the host answers requests
  - phone numbers are shared only after a seat is accepted
  - guests never see where the host's drive starts

## The app (`frontend/`)

### Requirements
- Node.js LTS
- Android SDK and JDK 17, with `ANDROID_HOME` and `JAVA_HOME` set (Android Studio installs both)
- An Android phone with USB debugging on, or the emulator

### Set up and run
```bash
cd frontend
cp .env.example .env               # then paste your Mapbox public token (pk.…) into .env
npm install
npx expo run:android               # first time, or after adding a package with native code: builds and installs the app
npx expo start                     # every day after that: then open Cpool on the phone
```
- **Expo Go is not supported:** use the development build that `expo run:android` installs.
- **When to rebuild:** only after adding a package with native code. Ordinary code changes reload on the phone by themselves.
- **`.env` is git-ignored.** Never commit a token; the repo is public.

### Windows notes
- **PowerShell blocks `npm` scripts:** if you see "running scripts is disabled", type `npm.cmd` / `npx.cmd` instead, or use Command Prompt.
- **Windows' 260-character path limit:**
  - **Keep the repo in a short folder** (for example `C:\cpool`).
  - **Use a newer CMake for the build:** install it with `sdkmanager "cmake;3.31.6"`. Then put this line in `frontend\android\local.properties` (git-ignored; recreate it after `expo prebuild --clean`):
    ```
    cmake.dir=C:/Users/<you>/AppData/Local/Android/Sdk/cmake/3.31.6
    ```
    The default CMake's build tool fails with "Filename longer than 260 characters".

### Scripts (in `frontend/`)
| Command | What it does |
|---|---|
| `npm start` | Start the dev server |
| `npm run android` | Build and install on Android |
| `npm run lint` | Check code style |

### Folder structure
```
frontend/
├── src/
│   ├── app/                   screens (Expo Router: every file is a route)
│   │   ├── (auth)/            welcome, sign up, sign in, forgot password, code, set up account (password + mobile)
│   │   ├── (onboarding)/      role, vehicle type, helmet, seats, RC photo, vehicle details
│   │   ├── (tabs)/            home, my rides, alerts, account
│   │   ├── places · pin · results · pickup-map     plan a ride, drop a pin, rides found, meet point on the map
│   │   ├── requested · accepted · cancel-booking · cancelled    seat request and its outcome
│   │   ├── coming · riding · request · drive       live maps (host coming, riding, host's seat requests, host driving)
│   │   ├── edit-profile · change-password
│   │   └── index.jsx          sends you to welcome, role or home
│   ├── components/            LiveMap (Mapbox), RideUI, StatusHeader, WhenSheet, OfflineGate, buttons, fields
│   ├── constants/theme.js     colours, spacing, font sizes, light/dark mode, sizes that scale with the screen
│   └── lib/
│       ├── api.js             every server call (example data for now) and Mapbox place search
│       ├── directions.js      Mapbox Directions: routes, traffic, turn steps, meet point
│       ├── trips.js · session.js · onboarding.js    app state: rides, signed-in user, vehicle setup
│       ├── mock.js            example data
│       └── …                  map helpers, route maths, dates, alerts (sound + vibration), RC reading, GPS
└── assets/                    icons, splash, onboarding photos, sounds
```
`android/` and `ios/` are generated by the build and are not committed.

## The backend (`backend/`)

### Run
Python 3.12 or newer:
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate              # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate            # also after pulling: applies database changes
python manage.py createsuperuser    # once, for the admin panel (username = your email)
python manage.py runserver          # http://localhost:8000
python manage.py test api           # run the tests
```
If port 8000 is taken, use another one: `python manage.py runserver 8001`.

### Useful pages
- **Swagger UI**, to try every route in the browser: http://localhost:8000/api/docs/. Log in with `/v1/auth/login`, then click **Authorize** and paste the token.
- **Admin panel:** http://localhost:8000/admin/ shows users, vehicles, rides, bookings, alerts and SOS alerts. Untick *Active* on a user to switch off someone who has left.
- **Sign-in codes** print in the `runserver` terminal until email is set up.

### Settings (environment variables)
| Variable | Use |
|---|---|
| `DJANGO_DEBUG` | `0` in production (default `1`) |
| `DJANGO_SECRET_KEY` | required when `DJANGO_DEBUG=0` |
| `DJANGO_ALLOWED_HOSTS` | comma-separated host names (default: localhost) |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM` | send sign-in codes by SMTP instead of printing them |
| `SOS_EMAIL` | the security desk's address for SOS alerts |

### Folder structure
```
backend/
├── cpool/          settings and URLs
├── api/
│   ├── models.py   users, vehicles, rides, bookings, live locations, SOS, alerts, sign-in codes
│   ├── views.py    sign-up, login, profile, vehicles, delete account
│   ├── rides.py    rides, search, bookings, live location, SOS, alerts, history
│   ├── geo.py      distances and the closest point on a route
│   ├── auth.py     the "Authorization: Bearer" check
│   └── tests.py · test_rides.py
└── requirements.txt
```
The database is SQLite while building (`db.sqlite3`, git-ignored). Switching to PostgreSQL for hosting only needs a settings change.

## Testing the app with the backend on a phone

Once `frontend/src/lib/api.js` calls the real backend, run both on your laptop with the phone connected by USB:

1. **Once:** add `EXPO_PUBLIC_API_URL=http://localhost:8000` to `frontend/.env`.
2. **Terminal 1:** `cd backend`, then `python manage.py runserver`.
3. **Terminal 2:** `cd frontend`, then:
   ```bash
   adb reverse tcp:8081 tcp:8081      # the app's code
   adb reverse tcp:8000 tcp:8000      # the backend
   npx expo start
   ```
4. Open Cpool on the phone.

USB is used because office Wi-Fi blocks phone-to-laptop traffic.

**To test a host and a guest at once:**
- **With two phones:** install the same app on the second phone with `adb -s <phone-id> install -r android/app/build/outputs/apk/debug/app-debug.apk`. Run the two `adb reverse` lines for each phone, adding `-s <phone-id>`.
- **With one phone:** play the other person in Swagger.

## API

The contract between the app and the backend. **If a route or shape changes, update this section first.**

- **Login token:** every route except sign-up/login needs `Authorization: Bearer <token>`.
- **Errors:** HTTP 4xx with `{code, message}`; invalid input also has `fields: {name: message}`.
- **Coordinates** are `[lng, lat]`. **Times** are ISO 8601 with a timezone.

### Sign-up and login
| Method | Path | Request → response |
|---|---|---|
| POST | `/v1/auth/signup` | `{email}` → `{ok}`: sends a code. Errors: `not_work_email`, `already_registered` |
| POST | `/v1/auth/forgot` | `{email}` → `{ok}`: sends a code (same answer whether or not the account exists) |
| POST | `/v1/auth/verify` | `{email, code, purpose: "signup" \| "reset"}` → `{token}` (valid 15 min). Errors: `wrong_code`, `code_expired` (codes last 10 min), `too_many_tries` (5) |
| POST | `/v1/auth/set-password` | `{token, password, phone}` → `{ok}`. A sign-up token creates the account and **needs `phone`**: an Indian mobile, 10 digits starting 6–9, `+91` optional, stored as `+91XXXXXXXXXX`. A reset token ignores `phone` and signs out every phone. Errors: `token_expired`, `phone_required`, `invalid_phone`, `weak_password`, `already_registered` |
| POST | `/v1/auth/login` | `{email, password}` → `{token, role, vehicle, phone}`. `role` is null on the first sign-in, which leads to first-time setup. Errors: `not_registered`, `wrong_password`, `account_disabled` |
| POST | `/v1/auth/logout` | → `{ok}`: the token stops working |

### Me
| Method | Path | Request → response |
|---|---|---|
| GET | `/v1/me` | `{email, name, gender, phone, role, vehicle}` |
| PUT / PATCH | `/v1/me` | changes only the fields sent: `role` (`"guest"` \| `"host"`, set at first-time setup), `name`, `gender`, `phone` (same check as sign-up; it can be changed, not removed) |
| POST | `/v1/me/password` | `{current, new}` → `{ok, token}`. Other phones are signed out, so use the new token. Errors: `wrong_password`, `weak_password` |
| GET | `/v1/me/trip` | what Home shows; poll it until push notifications exist. Returns `{ride, booking}`: **`ride`** is the ride you host, with its `bookings` (oldest first; `alongKm` is how far along your route each guest is, so sort by it to drive pickups in order); **`booking`** is your latest seat request (kept for 24 h after it ends, so the app can show "declined") |
| GET | `/v1/me/history` | My rides → Past and the Account numbers: `{stats: {ridesTaken, ridesGiven, kmShared}, rides: [{role, rideId, when, from, to, with, km}]}` |
| POST | `/v1/me/delete` | `{password}` → `{ok}`: deletes your account and wipes your name, email, phone and number plates. Past rides stay for others, showing "Deleted user". Errors: `wrong_password`, `already_on_trip` |
| PUT | `/v1/me/devices` | push notification token: **not built yet** |

### Vehicles
| Method | Path | Request → response |
|---|---|---|
| GET | `/v1/me/vehicles` | your vehicles; `isDefault` marks the default (the one you picked, else the first one added) |
| POST | `/v1/me/vehicles` | `{type: "bike" \| "car", number, model, mfgMonth, mfgYear, colour?, seats, helmet}`. `seats`: bike 1, car 1–7. `helmet`: `"host"` \| `"guest"` for bikes, null for cars |
| PATCH | `/v1/me/vehicles/{id}` | edit: only the fields sent change. Error: `vehicle_in_use` while the vehicle is on an open ride |
| DELETE | `/v1/me/vehicles/{id}` | remove it from the app (kept for past rides). Error: `vehicle_in_use` |
| POST | `/v1/me/vehicles/{id}/default` | make it the default → your vehicle list |

### Alerts
| Method | Path | Request → response |
|---|---|---|
| GET | `/v1/me/alerts` | newest first: `[{id, kind, title, text, at, read, who: {name, initials}, rideId, bookingId}]`. `kind` is `request`, `accepted`, `declined` or `cancelled` |
| POST | `/v1/me/alerts/read` | `{ids?}` → `{ok}`: marks those read (all of them if `ids` is left out) |
| DELETE | `/v1/me/alerts/{id}` | removes one alert |

### Rides
| Method | Path | Request → response |
|---|---|---|
| POST | `/v1/rides` | `{from, to, departAt, seats, vehicleId?, route: [[lng, lat], …]}`. `from` and `to` are `{officeId}` or `{name, coords}`, and exactly one must be an office. `departAt` must be 10 min to 7 days ahead. `route` is the road route from Mapbox Directions. Errors: `needs_office`, `bad_time`, `no_vehicle`, `too_many_seats`, `already_on_trip` |
| GET | `/v1/rides/search` | `?officeId=&direction=to_office\|from_office&at=<ISO>&lng=&lat=`. `lng`/`lat` is your pickup, or your drop when leaving the office. Returns rides leaving within ±30 min whose route passes within 1.5 km: `[{id, host, departAt, meetPoint, walkToMeters, rideKm, walkFromMeters, seatsFree, seatsTotal, match: "full" \| "partial", route}]`. `route` is only the part you ride on. `host.phone` is null until accepted. Full rides are never returned |
| POST | `/v1/rides/{id}/start` | host only. Needed before guests can be marked picked up |
| POST | `/v1/rides/{id}/complete` | host only, after `start` |
| POST | `/v1/rides/{id}/cancel` | host only. `{reason?}`: cancels every booking on the ride and tells the guests |

### Bookings
| Method | Path | Request → response |
|---|---|---|
| POST | `/v1/rides/{id}/bookings` | guest: `{meetPoint: [lng, lat], meetName}` → your booking. Errors: `own_ride`, `ride_closed`, `ride_full`, `already_on_trip` |
| POST | `/v1/bookings/{id}/accept` | host: takes a seat. Error: `ride_full` when none are left |
| POST | `/v1/bookings/{id}/reject` | host: declines the request |
| POST | `/v1/bookings/{id}/cancel` | guest: `{reason?}` withdraws a request, or frees a confirmed seat |
| POST | `/v1/bookings/{id}/picked-up` · `no-show` | host, after `start` |

**Booking status:** `requested` → `accepted`, `declined`, `withdrawn` (by the guest) or `cancelled` (by the host) → `picked_up` or `no_show`.

### Live location and SOS
| Method | Path | Request → response |
|---|---|---|
| POST | `/v1/rides/{id}/locations` | host or confirmed guest, every ~5 s: `{coords, heading?, atMeetPoint?}`. `atMeetPoint` means the guest's phone says it's within 50 m of the meet point |
| GET | `/v1/rides/{id}/live` | `{host: {coords, heading, at}, guests: [{bookingId, name, coords, heading, at, atMeetPoint}]}`. Guests see only the host; the host sees their guests |
| POST | `/v1/rides/{id}/sos` | `{coords?}` → `{ok}`: saved for the security desk (admin panel), and emailed if `SOS_EMAIL` is set |

## Working together

- **Separate areas:** Aswin works in `frontend/`, Siddhant in `backend/`. Neither edits the other's code.
- **Branches and PRs:** work on a branch, merge `main` into it often, and open a PR. Merge PRs with **"Create a merge commit"**, not "Squash and merge".
- **Shared files** (`README.md`, `CLAUDE.md`, the root `.gitignore`): pull `main` first, keep the change small, and merge it quickly.
- **Notes between the Claudes:** see `CLAUDE.md`. Say "check cmem" after a pull and "update cmem" before a push.
- **Never commit secrets:** `.env`, tokens, passwords or real phone numbers. The repo is public.
