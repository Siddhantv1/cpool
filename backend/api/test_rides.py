from datetime import timedelta

from django.core.cache import cache
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from . import geo
from .models import Booking, Ride, Sos, User, Vehicle

PASSWORD = "Cpool1234"
# Koramangala → along lat 12.93 → Perficient Bellandur.
ROUTE = [[77.62, 12.93], [77.65, 12.93], [77.6914, 12.9307]]
NEAR = [77.65, 12.9324]  # ~270 m north of the route
FARTHER = [77.65, 12.938]  # ~880 m: still shown, "partial"
FAR = [77.65, 12.96]  # ~3.3 km: not shown


class GeoTests(APITestCase):
    def test_nearest_point_on_route(self):
        meet, dist, along, i = geo.nearest(ROUTE, NEAR)
        self.assertLess(geo.km(meet, [77.65, 12.93]), 0.01)  # at the bend (within 10 m; the next part slopes slightly)
        self.assertAlmostEqual(dist, 0.265, places=2)
        self.assertAlmostEqual(along, geo.km(ROUTE[0], ROUTE[1]), places=2)

    def test_point_between_corners(self):
        meet, dist, _, i = geo.nearest(ROUTE, [77.635, 12.925])
        self.assertEqual(i, 0)
        self.assertAlmostEqual(meet[0], 77.635, places=4)
        self.assertAlmostEqual(dist, 0.553, places=2)


class RideTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.host = self.make_user("host@perficient.com", phone="+919800000001", seats=2)
        self.guest = self.make_user("guest.one@perficient.com", phone="+919800000002")
        self.guest2 = self.make_user("guest.two@perficient.com")
        self.depart = timezone.now() + timedelta(hours=2)

    def make_user(self, email, phone="", seats=None):
        user = User.objects.create_user(username=email, email=email, password=PASSWORD, phone=phone)
        if seats:
            Vehicle.objects.create(owner=user, type="car", number="KA05MX2231", model="Hyundai i20", mfg_month=1, mfg_year=2021, seats=seats)
        return user

    def call(self, user, method, url, data=None, status=200):
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.key}")
        res = self.client.get(url, data) if method == "get" else self.client.post(url, data or {}, format="json")
        self.assertEqual(res.status_code, status, res.data)
        return res.data

    def ride_body(self, **changes):
        return {"from": {"name": "Koramangala", "coords": ROUTE[0]}, "to": {"officeId": "bellandur"},
                "departAt": self.depart.isoformat(), "seats": 2, "route": ROUTE, **changes}

    def offer(self, user=None, **changes):
        return self.call(user or self.host, "post", "/v1/rides", self.ride_body(**changes), 201)

    def search(self, user, where, at=None):
        q = {"officeId": "bellandur", "direction": "to_office", "at": (at or self.depart).isoformat(), "lng": where[0], "lat": where[1]}
        return self.call(user, "get", "/v1/rides/search", q)

    def request_seat(self, user, ride_id, status=201):
        return self.call(user, "post", f"/v1/rides/{ride_id}/bookings", {"meetPoint": [77.65, 12.93], "meetName": "Near Ejipura signal"}, status)

    def test_offer_rules(self):
        code = lambda status, **changes: self.call(self.host, "post", "/v1/rides", self.ride_body(**changes), status)["code"]
        self.assertEqual(code(400, to={"name": "Somewhere", "coords": ROUTE[-1]}), "needs_office")
        self.assertEqual(code(400, departAt=(timezone.now() + timedelta(minutes=5)).isoformat()), "bad_time")
        self.assertEqual(code(400, seats=3), "too_many_seats")
        self.assertEqual(self.call(self.guest, "post", "/v1/rides", self.ride_body(), 400)["code"], "no_vehicle")
        ride = self.offer()
        self.assertEqual((ride["direction"], ride["to"]["coords"]), ("to_office", [77.6914, 12.9307]))  # server's office coords
        self.assertEqual(code(409), "already_on_trip")

    def test_search_matching(self):
        ride = self.offer()
        [hit] = self.search(self.guest, NEAR)
        self.assertEqual((hit["id"], hit["match"]), (ride["id"], "full"))
        self.assertLess(geo.km(hit["meetPoint"], [77.65, 12.93]), 0.01)
        self.assertAlmostEqual(hit["walkToMeters"], 265, delta=10)
        self.assertAlmostEqual(hit["rideKm"], geo.km(ROUTE[1], ROUTE[2]), delta=0.1)
        self.assertEqual(hit["route"][0], hit["meetPoint"])  # starts at the meet point...
        self.assertNotIn(ROUTE[0], hit["route"])  # ...so the host's start (home) is never sent
        self.assertIsNone(hit["host"]["phone"])  # phone only after acceptance
        self.assertEqual(self.search(self.guest, FARTHER)[0]["match"], "partial")
        self.assertEqual(self.search(self.guest, FAR), [])
        self.assertEqual(self.search(self.host, NEAR), [])  # not your own ride
        self.assertEqual(self.search(self.guest, NEAR, at=self.depart + timedelta(minutes=45)), [])  # outside ±30 min

    def test_request_accept_cancel(self):
        ride = self.offer()
        booking = self.request_seat(self.guest, ride["id"])
        self.assertEqual(booking["status"], "requested")
        [req] = self.call(self.host, "get", "/v1/me/trip")["ride"]["bookings"]
        self.assertEqual((req["guest"]["name"], req["guest"]["phone"]), ("Guest One", None))

        after = self.call(self.host, "post", f"/v1/bookings/{booking['id']}/accept")
        self.assertEqual((after["seatsLeft"], after["bookings"][0]["guest"]["phone"]), (1, "+919800000002"))
        mine = self.call(self.guest, "get", "/v1/me/trip")["booking"]
        self.assertEqual((mine["status"], mine["ride"]["host"]["phone"]), ("accepted", "+919800000001"))

        cancelled = self.call(self.guest, "post", f"/v1/bookings/{booking['id']}/cancel", {"reason": "My plans changed"})
        self.assertEqual((cancelled["status"], cancelled["reason"]), ("withdrawn", "My plans changed"))
        self.assertEqual(Ride.objects.get(pk=ride["id"]).seats_left, 2)  # seat freed

    def test_last_seat_goes_to_one_guest(self):
        ride = self.offer(seats=1)
        first = self.request_seat(self.guest, ride["id"])
        second = self.request_seat(self.guest2, ride["id"])
        self.call(self.host, "post", f"/v1/bookings/{first['id']}/accept")
        self.assertEqual(self.call(self.host, "post", f"/v1/bookings/{second['id']}/accept", status=409)["code"], "ride_full")
        self.assertEqual(Booking.objects.get(pk=second["id"]).status, "requested")  # the failed accept was rolled back
        self.assertEqual(self.request_seat(self.make_user("late@perficient.com"), ride["id"], 409)["code"], "ride_full")

    def test_one_trip_at_a_time(self):
        ride = self.offer()
        self.request_seat(self.guest, ride["id"])
        self.assertEqual(self.request_seat(self.guest, ride["id"], 409)["code"], "already_on_trip")
        self.assertEqual(self.request_seat(self.host, ride["id"], 409)["code"], "own_ride")
        Vehicle.objects.create(owner=self.guest, type="bike", number="KA01HX8812", model="Pulsar", mfg_month=1, mfg_year=2020, seats=1, helmet="host")
        # Can't host while waiting for a seat.
        self.assertEqual(self.call(self.guest, "post", "/v1/rides", self.ride_body(seats=1), 409)["code"], "already_on_trip")

    def test_only_the_right_person_can_act(self):
        ride = self.offer()
        booking = self.request_seat(self.guest, ride["id"])
        self.call(self.guest2, "post", f"/v1/bookings/{booking['id']}/accept", status=404)  # not the host
        self.call(self.host, "post", f"/v1/bookings/{booking['id']}/cancel", status=404)  # not the guest
        self.call(self.guest, "post", f"/v1/rides/{ride['id']}/cancel", status=404)

    def test_host_cancels_ride(self):
        ride = self.offer()
        booking = self.request_seat(self.guest, ride["id"])
        self.call(self.host, "post", f"/v1/bookings/{booking['id']}/accept")
        self.call(self.host, "post", f"/v1/rides/{ride['id']}/cancel", {"reason": "Car trouble"})
        mine = self.call(self.guest, "get", "/v1/me/trip")["booking"]
        self.assertEqual((mine["status"], mine["reason"], mine["ride"]["status"]), ("cancelled", "Car trouble", "cancelled"))
        other = self.offer(user=self.make_user("other.host@perficient.com", seats=3))
        self.request_seat(self.guest, other["id"])  # free to book again

    def test_drive_pick_up_complete(self):
        ride = self.offer()
        booking = self.request_seat(self.guest, ride["id"])
        self.call(self.host, "post", f"/v1/bookings/{booking['id']}/accept")
        self.assertEqual(self.call(self.host, "post", f"/v1/bookings/{booking['id']}/picked-up", status=409)["code"], "not_allowed_now")
        self.call(self.host, "post", f"/v1/rides/{ride['id']}/start")
        self.call(self.host, "post", f"/v1/bookings/{booking['id']}/picked-up")
        self.assertEqual(self.call(self.host, "post", f"/v1/rides/{ride['id']}/complete")["status"], "completed")
        self.assertIsNone(self.call(self.host, "get", "/v1/me/trip")["ride"])
        self.assertEqual(self.call(self.guest, "get", "/v1/me/trip")["booking"]["status"], "picked_up")

    def test_live_location_privacy(self):
        ride = self.offer()
        booking = self.request_seat(self.guest, ride["id"])
        self.call(self.host, "post", f"/v1/bookings/{booking['id']}/accept")
        self.call(self.guest2, "get", f"/v1/rides/{ride['id']}/live", status=404)  # not on this ride

        self.call(self.host, "post", f"/v1/rides/{ride['id']}/locations", {"coords": [77.63, 12.93], "heading": 90})
        self.call(self.guest, "post", f"/v1/rides/{ride['id']}/locations", {"coords": [77.6501, 12.9321]})
        seen_by_guest = self.call(self.guest, "get", f"/v1/rides/{ride['id']}/live")
        self.assertEqual((seen_by_guest["host"]["coords"], seen_by_guest["guests"]), ([77.63, 12.93], []))
        seen_by_host = self.call(self.host, "get", f"/v1/rides/{ride['id']}/live")
        self.assertEqual(seen_by_host["guests"][0]["coords"], [77.6501, 12.9321])

    def test_sos(self):
        ride = self.offer()
        self.call(self.host, "post", f"/v1/rides/{ride['id']}/sos", {"coords": [77.63, 12.93]})
        self.assertEqual(Sos.objects.get().user, self.host)
        self.call(self.guest, "post", f"/v1/rides/{ride['id']}/sos", {}, 404)  # not on the ride

    # ---------- part 3: alerts, history, vehicles, account deletion ----------

    def alerts(self, user):
        return self.call(user, "get", "/v1/me/alerts")

    def test_alerts_follow_the_ride(self):
        ride = self.offer()
        booking = self.request_seat(self.guest, ride["id"])
        [req] = self.alerts(self.host)
        self.assertEqual((req["kind"], req["title"], req["read"], req["who"]["name"]), ("request", "Guest asked for a seat", False, "Guest One"))
        self.assertIn("pickup at Near Ejipura signal", req["text"])

        self.call(self.host, "post", f"/v1/bookings/{booking['id']}/accept")
        self.assertEqual(self.alerts(self.guest)[0]["title"], "Host accepted your request")
        self.call(self.guest, "post", f"/v1/bookings/{booking['id']}/cancel", {"reason": "Running late"})
        newest, oldest = self.alerts(self.host)
        self.assertEqual((newest["kind"], newest["title"], oldest["kind"]), ("cancelled", "Guest cancelled their seat", "request"))
        self.assertIn("Running late", newest["text"])

        declined = self.request_seat(self.guest2, ride["id"])
        self.call(self.host, "post", f"/v1/bookings/{declined['id']}/reject")
        self.assertEqual(self.alerts(self.guest2)[0]["kind"], "declined")

        third = self.request_seat(self.guest, ride["id"])
        self.call(self.host, "post", f"/v1/rides/{ride['id']}/cancel", {"reason": "Car trouble"})
        mine = self.alerts(self.guest)[0]
        self.assertEqual((mine["kind"], mine["bookingId"]), ("cancelled", third["id"]))
        self.assertIn("Car trouble", mine["text"])

    def test_read_and_remove_alerts(self):
        ride = self.offer()
        self.request_seat(self.guest, ride["id"])
        b2 = self.request_seat(self.guest2, ride["id"])
        first, second = self.alerts(self.host)
        self.call(self.host, "post", "/v1/me/alerts/read", {"ids": [first["id"]]})
        self.assertEqual([a["read"] for a in self.alerts(self.host)], [True, False])
        self.call(self.host, "post", "/v1/me/alerts/read")  # no ids = all
        self.assertTrue(all(a["read"] for a in self.alerts(self.host)))
        self.as_delete(self.guest, f"/v1/me/alerts/{second['id']}", 404)  # someone else's alert
        self.as_delete(self.host, f"/v1/me/alerts/{second['id']}")
        self.assertEqual([a["id"] for a in self.alerts(self.host)], [first["id"]])
        self.assertEqual(b2["status"], "requested")

    def as_delete(self, user, url, status=200):
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.key}")
        res = self.client.delete(url)
        self.assertEqual(res.status_code, status, res.data)
        return res.data

    def test_history_and_stats(self):
        ride = self.offer()
        booking = self.request_seat(self.guest, ride["id"])
        self.call(self.host, "post", f"/v1/bookings/{booking['id']}/accept")
        self.call(self.host, "post", f"/v1/rides/{ride['id']}/start")
        self.assertEqual(self.call(self.guest, "get", "/v1/me/history")["rides"], [])  # not finished yet
        self.call(self.host, "post", f"/v1/bookings/{booking['id']}/picked-up")
        self.call(self.host, "post", f"/v1/rides/{ride['id']}/complete")

        guest = self.call(self.guest, "get", "/v1/me/history")
        [row] = guest["rides"]
        self.assertEqual((row["role"], row["from"], row["to"], row["with"]), ("guest", "Near Ejipura signal", "Perficient Bellandur", ["Host"]))
        self.assertAlmostEqual(row["km"], geo.km(ROUTE[1], ROUTE[2]), delta=0.2)
        self.assertEqual((guest["stats"]["ridesTaken"], guest["stats"]["ridesGiven"]), (1, 0))

        host = self.call(self.host, "get", "/v1/me/history")
        self.assertEqual((host["stats"]["ridesGiven"], host["rides"][0]["with"]), (1, ["Guest One"]))
        self.assertGreater(host["stats"]["kmShared"], 0)

    def test_vehicles_default_edit_remove(self):
        bike = self.call(self.host, "post", "/v1/me/vehicles", {"type": "bike", "number": "KA01HX8812", "model": "Pulsar", "mfgMonth": 1, "mfgYear": 2020, "seats": 1, "helmet": "guest"}, 201)
        car, second = self.call(self.host, "get", "/v1/me/vehicles")
        self.assertEqual((car["isDefault"], second["isDefault"]), (True, False))  # first one added is the default

        listed = self.call(self.host, "post", f"/v1/me/vehicles/{bike['id']}/default")
        self.assertEqual([v["isDefault"] for v in listed], [False, True])
        self.assertEqual(self.call(self.host, "get", "/v1/me")["vehicle"]["id"], bike["id"])

        self.assertEqual(self.call_patch(self.host, f"/v1/me/vehicles/{car['id']}", {"seats": 3})["seats"], 3)
        self.assertEqual(list(self.call_patch(self.host, f"/v1/me/vehicles/{bike['id']}", {"seats": 2}, 400)["fields"]), ["seats"])

        ride = self.offer(vehicleId=car["id"])
        self.assertEqual(self.call_patch(self.host, f"/v1/me/vehicles/{car['id']}", {"seats": 2}, 409)["code"], "vehicle_in_use")
        self.assertEqual(self.as_delete(self.host, f"/v1/me/vehicles/{car['id']}", 409)["code"], "vehicle_in_use")
        self.call(self.host, "post", f"/v1/rides/{ride['id']}/cancel")
        self.as_delete(self.host, f"/v1/me/vehicles/{car['id']}")
        self.assertEqual([v["id"] for v in self.call(self.host, "get", "/v1/me/vehicles")], [bike["id"]])
        self.assertEqual(Ride.objects.get(pk=ride["id"]).vehicle_id, car["id"])  # past rides keep their vehicle

    def call_patch(self, user, url, data, status=200):
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.key}")
        res = self.client.patch(url, data, format="json")
        self.assertEqual(res.status_code, status, res.data)
        return res.data

    def test_delete_account(self):
        ride = self.offer()
        booking = self.request_seat(self.guest, ride["id"])
        self.assertEqual(self.call(self.guest, "post", "/v1/me/delete", {"password": "wrong"}, 400)["code"], "wrong_password")
        self.assertEqual(self.call(self.guest, "post", "/v1/me/delete", {"password": PASSWORD}, 409)["code"], "already_on_trip")
        self.call(self.guest, "post", f"/v1/bookings/{booking['id']}/cancel")
        self.call(self.guest, "post", "/v1/me/delete", {"password": PASSWORD})

        self.assertEqual(self.client.get("/v1/me").status_code, 401)  # signed out
        gone = User.objects.get(pk=self.guest.pk)
        self.assertEqual((gone.username, gone.email, gone.phone, gone.name, gone.is_active), (f"deleted-{gone.pk}", "", "", "Deleted user", False))
        self.client.credentials()
        res = self.client.post("/v1/auth/login", {"email": "guest.one@perficient.com", "password": PASSWORD}, format="json")
        self.assertEqual(res.data["code"], "not_registered")
        self.assertEqual(self.client.post("/v1/auth/signup", {"email": "guest.one@perficient.com"}, format="json").status_code, 200)  # can join again
        self.assertEqual(self.alerts(self.host)[0]["who"]["name"], "Deleted user")  # the host's history no longer names them
