"""Rides, seat bookings, live location and SOS.

Rules kept here: one active trip per person (hosting or riding), no double booking (a seat is taken in one
conditional UPDATE), only the host answers requests, only the guest withdraws. Routes follow the README table."""

import os
import re
from datetime import timedelta

from django.core.mail import send_mail
from django.db import IntegrityError, transaction
from django.db.models import F, Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.decorators import api_view
from rest_framework.response import Response

from . import geo
from .models import ACTIVE_BOOKING, ACTIVE_RIDE, OFFICES, Alert, Booking, Location, Ride, Sos
from .views import ApiError, VehicleSerializer, body, ok

MAX_WALK_KM = 1.5  # rides whose route passes farther than this from you aren't shown
FULL_MATCH_KM = 0.5  # walks up to this are a "full" match, longer ones "partial"
WINDOW = timedelta(minutes=30)  # search shows rides leaving within ± this of your time
MIN_NOTICE, MAX_AHEAD = timedelta(minutes=10), timedelta(days=7)  # same limits as the app's time picker
SEES_PHONE = ["accepted", "picked_up"]  # phone numbers are shared only once a seat is confirmed


# ---------- input shapes ----------

class Coords(serializers.ListField):
    """[longitude, latitude]"""

    def __init__(self, **kwargs):
        super().__init__(child=serializers.FloatField(), min_length=2, max_length=2, **kwargs)

    def to_internal_value(self, data):
        lng, lat = super().to_internal_value(data)
        if not (-180 <= lng <= 180 and -90 <= lat <= 90):
            raise serializers.ValidationError("Use [longitude, latitude].")
        return [lng, lat]


class PlaceIn(serializers.Serializer):
    """An office ({officeId}) or any place ({name, coords})."""

    officeId = serializers.ChoiceField(list(OFFICES), required=False)
    name = serializers.CharField(max_length=120, required=False)
    coords = Coords(required=False)

    def validate(self, data):
        if data.get("officeId"):
            office = OFFICES[data["officeId"]]
            return {"officeId": data["officeId"], "name": office["name"], "coords": office["coords"]}
        if not data.get("name") or not data.get("coords"):
            raise serializers.ValidationError("Give an officeId, or a name and coords.")
        return {"name": data["name"], "coords": data["coords"]}


# "from" is a Python keyword, so this serializer is built with type().
RideIn = type("RideIn", (serializers.Serializer,), {
    "from": PlaceIn(),
    "to": PlaceIn(),
    "departAt": serializers.DateTimeField(),
    "seats": serializers.IntegerField(min_value=1, max_value=7),
    "vehicleId": serializers.IntegerField(required=False),
    "route": serializers.ListField(child=Coords(), min_length=2, max_length=10000),
})


BookingIn = type("BookingIn", (serializers.Serializer,), {"meetPoint": Coords(), "meetName": serializers.CharField(max_length=120)})
LocationIn = type("LocationIn", (serializers.Serializer,), {"coords": Coords(), "heading": serializers.FloatField(required=False, allow_null=True)})
SosIn = type("SosIn", (serializers.Serializer,), {"coords": Coords(required=False)})
AlertsReadIn = type("AlertsReadIn", (serializers.Serializer,), {"ids": serializers.ListField(child=serializers.IntegerField(), required=False)})


class SearchIn(serializers.Serializer):
    officeId = serializers.ChoiceField(list(OFFICES))
    direction = serializers.ChoiceField(["to_office", "from_office"])
    at = serializers.DateTimeField(help_text="When you want to leave (ISO 8601)")
    lng = serializers.FloatField(min_value=-180, max_value=180, help_text="Your pickup (to office) or drop (from office)")
    lat = serializers.FloatField(min_value=-90, max_value=90)


def valid(serializer_class, data):
    s = serializer_class(data=data)
    s.is_valid(raise_exception=True)
    return s.validated_data


# ---------- output shapes ----------

def display_name(user):
    if user.name:
        return user.name
    return " ".join(w.capitalize() for w in re.split(r"[._-]", user.username.split("@")[0]) if w)


def person(user, phone=False):
    name = display_name(user)
    return {"name": name, "initials": "".join(w[0] for w in name.split()[:2]).upper(), "phone": (user.phone or None) if phone else None}


def first_name(user):
    return display_name(user).split()[0]


def when(dt):
    """"Thu 29 Oct, 8:30 AM" in India time."""
    t = timezone.localtime(dt)
    return f"{t:%a} {t.day} {t:%b}, {t.hour % 12 or 12}:{t:%M} {'AM' if t.hour < 12 else 'PM'}"


def notify(user, kind, title, text, who, booking):
    """Add a line to someone's Alerts tab.
    ponytail: push notifications get sent from here too, once the app sends its push token (part 3, step 2)."""
    Alert.objects.create(user=user, kind=kind, title=title, text=text, who=who, ride_id=booking.ride_id, booking=booking)


def host_info(ride, phone=False):
    v = ride.vehicle
    return {**person(ride.host, phone), "vehicle": v.model, "type": v.type, "plate": v.number, "colour": v.colour, "helmet": v.helmet}


def shared_part(ride, point):
    """The bit of the host's route a guest rides on: meet point → office, or office → drop point.
    The host's own start (often their home) is never sent to guests."""
    meet, dist, along, i = geo.nearest(ride.route, point)
    if ride.direction == "to_office":
        return meet, dist, along, [meet, *ride.route[i + 1:]]
    return meet, dist, along, [*ride.route[: i + 1], meet]


def guest_view(booking):
    ride = booking.ride
    return {
        "id": booking.id,
        "status": booking.status,
        "reason": booking.reason,
        "meetPoint": booking.meet,
        "meetName": booking.meet_name,
        "createdAt": booking.created,
        "ride": {
            "id": ride.id,
            "officeId": ride.office,
            "office": OFFICES[ride.office]["name"],
            "direction": ride.direction,
            "departAt": ride.depart_at,
            "status": ride.status,
            "host": host_info(ride, phone=booking.status in SEES_PHONE),
            "route": shared_part(ride, booking.meet)[3],
        },
    }


def host_view(ride):
    bookings = ride.bookings.filter(status__in=[*ACTIVE_BOOKING, "no_show"]).select_related("guest")
    return {
        "id": ride.id,
        "from": ride.start,
        "to": ride.end,
        "officeId": ride.office,
        "direction": ride.direction,
        "departAt": ride.depart_at,
        "seatsTotal": ride.seats_total,
        "seatsLeft": ride.seats_left,
        "status": ride.status,
        "vehicle": VehicleSerializer(ride.vehicle).data,
        "route": ride.route,
        "bookings": [{
            "id": b.id,
            "status": b.status,
            "meetPoint": b.meet,
            "meetName": b.meet_name,
            "createdAt": b.created,
            "guest": {**person(b.guest, phone=b.status in SEES_PHONE), "rides": b.guest.bookings.filter(status="picked_up").count()},
        } for b in bookings],
    }


# ---------- rules ----------

def check_free(user):
    """One trip at a time: you can't host and ride together, or hold two seat requests."""
    if Ride.objects.filter(host=user, status__in=ACTIVE_RIDE).exists():
        raise ApiError("already_on_trip", "You’re hosting a ride. Finish or cancel it first.", 409)
    if Booking.objects.filter(guest=user, status__in=ACTIVE_BOOKING).exists():
        raise ApiError("already_on_trip", "You already have a seat requested or booked. Cancel it first.", 409)


def move(qs, to_status, from_statuses, message):
    """Change status only if it is still in an expected state (safe if two phones act at once)."""
    if qs.filter(status__in=from_statuses).update(status=to_status) != 1:
        raise ApiError("not_allowed_now", message, 409)


# ---------- rides ----------

@extend_schema(request=RideIn, responses={201: OpenApiTypes.OBJECT})
@api_view(["POST"])
def offer(request):
    data = valid(RideIn, request.data)
    start, end = data["from"], data["to"]
    if bool(start.get("officeId")) == bool(end.get("officeId")):
        raise ApiError("needs_office", "One end of the ride must be a Perficient office, and only one.")
    now = timezone.now()
    if not now + MIN_NOTICE <= data["departAt"] <= now + MAX_AHEAD:
        raise ApiError("bad_time", "Pick a time from 10 minutes to 7 days from now.")
    vehicle = request.user.active_vehicles().filter(pk=data["vehicleId"]).first() if "vehicleId" in data else request.user.vehicle()
    if not vehicle:
        raise ApiError("no_vehicle", "Add a vehicle before offering a ride.")
    if data["seats"] > vehicle.seats:
        raise ApiError("too_many_seats", f"Your {vehicle.model} has {vehicle.seats} guest seat{'s' if vehicle.seats > 1 else ''}.")
    check_free(request.user)
    try:
        with transaction.atomic():
            ride = Ride.objects.create(
                host=request.user, vehicle=vehicle, office=end.get("officeId") or start["officeId"],
                direction="to_office" if end.get("officeId") else "from_office",
                start=start, end=end, route=data["route"], depart_at=data["departAt"],
                seats_total=data["seats"], seats_left=data["seats"],
            )
    except IntegrityError:  # a second publish raced the first
        raise ApiError("already_on_trip", "You’re hosting a ride. Finish or cancel it first.", 409)
    return Response(host_view(ride), status=201)


@extend_schema(parameters=[SearchIn], responses=OpenApiTypes.OBJECT)
@api_view(["GET"])
def search(request):
    q = valid(SearchIn, request.query_params)
    here = [q["lng"], q["lat"]]
    office = OFFICES[q["officeId"]]["coords"]
    rides = (
        Ride.objects.filter(office=q["officeId"], direction=q["direction"], status="open", seats_left__gt=0,
                            depart_at__gte=max(q["at"] - WINDOW, timezone.now()), depart_at__lte=q["at"] + WINDOW)
        .exclude(host=request.user)
        .select_related("host", "vehicle")
    )
    results = []
    for ride in rides:  # dozens at most after the filter above, so plain Python is plenty fast
        meet, walk_km, along, route = shared_part(ride, here)
        if walk_km > MAX_WALK_KM:
            continue
        if ride.direction == "to_office":
            walk_to, walk_from, ride_km = walk_km, geo.km(ride.route[-1], office), geo.length_km(ride.route) - along
        else:
            walk_to, walk_from, ride_km = geo.km(office, ride.route[0]), walk_km, along
        results.append({
            "id": ride.id,
            "host": host_info(ride),
            "departAt": ride.depart_at,
            "meetPoint": meet,
            "walkToMeters": round(walk_to * 1000),
            "rideKm": round(ride_km, 1),
            "walkFromMeters": round(walk_from * 1000),
            "seatsFree": ride.seats_left,
            "seatsTotal": ride.seats_total,
            "match": "full" if walk_km <= FULL_MATCH_KM else "partial",
            "route": route,
        })
    return Response(results)


def my_ride(request, ride_id):
    return get_object_or_404(Ride, pk=ride_id, host=request.user)


@extend_schema(request=None, responses=OpenApiTypes.OBJECT)
@api_view(["POST"])
def start_ride(request, ride_id):
    ride = my_ride(request, ride_id)
    move(Ride.objects.filter(pk=ride.pk), "started", ["open"], "This ride can’t be started now.")
    ride.refresh_from_db()
    return Response(host_view(ride))


@extend_schema(request=None, responses=OpenApiTypes.OBJECT)
@api_view(["POST"])
def complete_ride(request, ride_id):
    ride = my_ride(request, ride_id)
    with transaction.atomic():
        move(Ride.objects.filter(pk=ride.pk), "completed", ["started"], "Start the ride before completing it.")
        ride.bookings.filter(status="requested").update(status="declined", reason="The ride has ended")
        ride.bookings.filter(status="accepted").update(status="no_show")  # never marked as picked up
    ride.refresh_from_db()
    return Response(host_view(ride))


@extend_schema(request=body("RideCancelIn", {"reason": serializers.CharField(required=False)}), responses=OpenApiTypes.OBJECT)
@api_view(["POST"])
def cancel_ride(request, ride_id):
    ride = my_ride(request, ride_id)
    reason = str(request.data.get("reason") or "Plans changed")[:140]
    with transaction.atomic():
        move(Ride.objects.filter(pk=ride.pk), "cancelled", ACTIVE_RIDE, "This ride has already ended.")
        told = list(ride.bookings.filter(status__in=["requested", "accepted"]).select_related("guest"))
        ride.bookings.filter(pk__in=[b.pk for b in told]).update(status="cancelled", reason=reason)
        for b in told:
            notify(b.guest, "cancelled", f"{first_name(request.user)} cancelled the ride", f"{when(ride.depart_at)} · {reason}", request.user, b)
    ride.refresh_from_db()
    return Response(host_view(ride))


# ---------- bookings ----------

@extend_schema(request=BookingIn, responses={201: OpenApiTypes.OBJECT})
@api_view(["POST"])
def request_seat(request, ride_id):
    ride = get_object_or_404(Ride.objects.select_related("host", "vehicle"), pk=ride_id)
    data = valid(BookingIn, request.data)
    if ride.host_id == request.user.id:
        raise ApiError("own_ride", "You can’t book a seat on your own ride.", 409)
    if ride.status != "open" or ride.depart_at <= timezone.now():
        raise ApiError("ride_closed", "This ride isn’t taking requests any more.", 409)
    if ride.seats_left < 1:
        raise ApiError("ride_full", "This ride is full.", 409)
    check_free(request.user)
    try:
        with transaction.atomic():
            booking = Booking.objects.create(ride=ride, guest=request.user, meet=data["meetPoint"], meet_name=data["meetName"])
            notify(ride.host, "request", f"{first_name(request.user)} asked for a seat", f"{when(ride.depart_at)} · pickup at {booking.meet_name}", request.user, booking)
    except IntegrityError:  # a second request raced the first
        raise ApiError("already_on_trip", "You already have a seat requested or booked. Cancel it first.", 409)
    return Response(guest_view(booking), status=201)


def hosts_booking(request, booking_id):
    return get_object_or_404(Booking.objects.select_related("ride"), pk=booking_id, ride__host=request.user)


def fresh_host_view(ride_id):
    """Re-read the ride after a status/seat change, so the answer shows the new numbers."""
    return host_view(Ride.objects.select_related("vehicle").get(pk=ride_id))


@extend_schema(request=None, responses=OpenApiTypes.OBJECT)
@api_view(["POST"])
def accept(request, booking_id):
    booking = hosts_booking(request, booking_id)
    with transaction.atomic():
        move(Booking.objects.filter(pk=booking.pk, ride__status__in=ACTIVE_RIDE), "accepted", ["requested"],
             "This request was withdrawn or already answered.")
        # The seat is taken only if one is still free; otherwise the accept above is rolled back.
        if Ride.objects.filter(pk=booking.ride_id, seats_left__gt=0).update(seats_left=F("seats_left") - 1) != 1:
            raise ApiError("ride_full", "Your ride is already full.", 409)
        notify(booking.guest, "accepted", f"{first_name(request.user)} accepted your request", f"{when(booking.ride.depart_at)} · meet at {booking.meet_name}", request.user, booking)
    return Response(fresh_host_view(booking.ride_id))


@extend_schema(request=None, responses=OpenApiTypes.OBJECT)
@api_view(["POST"])
def reject(request, booking_id):
    booking = hosts_booking(request, booking_id)
    move(Booking.objects.filter(pk=booking.pk), "declined", ["requested"], "This request was withdrawn or already answered.")
    notify(booking.guest, "declined", f"{first_name(request.user)} couldn’t take you", "Your seat request was declined. Try another ride.", request.user, booking)
    return Response(fresh_host_view(booking.ride_id))


@extend_schema(request=body("BookingCancelIn", {"reason": serializers.CharField(required=False)}), responses=OpenApiTypes.OBJECT)
@api_view(["POST"])
def cancel_booking(request, booking_id):
    """The guest withdraws a request, or cancels a confirmed seat (which frees it for someone else)."""
    booking = get_object_or_404(Booking.objects.select_related("ride__host", "ride__vehicle"), pk=booking_id, guest=request.user)
    reason = str(request.data.get("reason") or "")[:140]
    with transaction.atomic():
        was = booking.status
        qs = Booking.objects.filter(pk=booking.pk)
        move(qs, "withdrawn", ["requested", "accepted"], "This seat can’t be cancelled now.")
        qs.update(reason=reason)
        if was == "accepted":
            Ride.objects.filter(pk=booking.ride_id).update(seats_left=F("seats_left") + 1)
        title = f"{first_name(request.user)} cancelled their seat" if was == "accepted" else f"{first_name(request.user)} withdrew their request"
        notify(booking.ride.host, "cancelled", title, f"{when(booking.ride.depart_at)} · {reason or 'No reason given'}", request.user, booking)
    booking.refresh_from_db()
    return Response(guest_view(booking))


def mark(new_status):
    @extend_schema(request=None, responses=OpenApiTypes.OBJECT)
    @api_view(["POST"])
    def view(request, booking_id):
        booking = hosts_booking(request, booking_id)
        if booking.ride.status != "started":
            raise ApiError("not_allowed_now", "Start the ride first.", 409)
        move(Booking.objects.filter(pk=booking.pk), new_status, ["accepted"], "Only a confirmed guest can be marked.")
        return Response(fresh_host_view(booking.ride_id))
    view.__name__ = new_status
    return view


picked_up = mark("picked_up")
no_show = mark("no_show")


# ---------- my current trip (the app polls this) ----------

@extend_schema(responses=OpenApiTypes.OBJECT)
@api_view(["GET"])
def my_trip(request):
    """What the app shows on Home: the ride you're hosting, and your latest seat request or booking.
    A booking that ended in the last 24 h is still returned, so the app can say "declined" or "cancelled"."""
    ride = Ride.objects.filter(host=request.user, status__in=ACTIVE_RIDE).select_related("vehicle").first()
    since = timezone.now() - timedelta(hours=24)
    booking = (
        Booking.objects.filter(guest=request.user).select_related("ride__host", "ride__vehicle").order_by("-created").first()
    )
    if booking and booking.status not in ACTIVE_BOOKING and booking.created < since:
        booking = None
    return Response({"ride": host_view(ride) if ride else None, "booking": guest_view(booking) if booking else None})


# ---------- live location and SOS ----------

def on_ride(request, ride_id):
    """The ride, if you're its host or a confirmed guest on it."""
    ride = get_object_or_404(Ride, pk=ride_id)
    if ride.host_id != request.user.id and not ride.bookings.filter(guest=request.user, status__in=SEES_PHONE).exists():
        raise ApiError("not_found", "No such ride.", 404)
    return ride


def position(loc):
    return {"coords": loc.coords, "heading": loc.heading, "at": loc.at} if loc else None


@extend_schema(request=LocationIn, responses=OpenApiTypes.OBJECT)
@api_view(["POST"])
def send_location(request, ride_id):
    ride = on_ride(request, ride_id)
    if ride.status not in ACTIVE_RIDE:
        raise ApiError("not_allowed_now", "This ride has ended.", 409)
    data = valid(LocationIn, request.data)
    Location.objects.update_or_create(ride=ride, user=request.user, defaults={"coords": data["coords"], "heading": data.get("heading")})
    return ok()


@extend_schema(responses=OpenApiTypes.OBJECT)
@api_view(["GET"])
def live(request, ride_id):
    """Guests see the host; the host sees their confirmed guests. Guests never see each other."""
    ride = on_ride(request, ride_id)
    locations = {loc.user_id: loc for loc in ride.locations.all()}
    guests = []
    if ride.host_id == request.user.id:
        guests = [{"bookingId": b.id, "name": display_name(b.guest), **position(locations[b.guest_id])}
                  for b in ride.bookings.filter(status__in=SEES_PHONE).select_related("guest") if b.guest_id in locations]
    return Response({"host": position(locations.get(ride.host_id)), "guests": guests})


@extend_schema(request=SosIn, responses=OpenApiTypes.OBJECT)
@api_view(["POST"])
def sos(request, ride_id):
    ride = on_ride(request, ride_id)
    coords = valid(SosIn, request.data).get("coords")
    alert = Sos.objects.create(ride=ride, user=request.user, coords=coords)
    # Saved first, so the alert is never lost; the email is a best-effort extra.
    if os.environ.get("SOS_EMAIL"):
        where = f"https://www.google.com/maps?q={coords[1]},{coords[0]}" if alert.coords else "location not sent"
        try:
            send_mail(f"Cpool SOS from {display_name(request.user)}", f"{request.user.username} raised SOS on ride {ride.id}.\n{where}", None, [os.environ["SOS_EMAIL"]])
        except Exception:
            pass
    return ok()


# ---------- alerts and history ----------

def alert_view(a):
    return {"id": a.id, "kind": a.kind, "title": a.title, "text": a.text, "at": a.created, "read": a.read,
            "who": person(a.who) if a.who else None, "rideId": a.ride_id, "bookingId": a.booking_id}


@extend_schema(responses=OpenApiTypes.OBJECT)
@api_view(["GET"])
def alerts(request):
    """Your Alerts tab, newest first (the last 100)."""
    return Response([alert_view(a) for a in request.user.alerts.select_related("who")[:100]])


@extend_schema(request=AlertsReadIn, responses=OpenApiTypes.OBJECT)
@api_view(["POST"])
def read_alerts(request):
    """Mark alerts as read: the ones in `ids`, or all of them when `ids` is left out."""
    ids = valid(AlertsReadIn, request.data).get("ids")
    unread = request.user.alerts.filter(read=False)
    (unread if ids is None else unread.filter(pk__in=ids)).update(read=True)
    return ok()


@extend_schema(request=None, responses=OpenApiTypes.OBJECT)
@api_view(["DELETE"])
def remove_alert(request, alert_id):
    get_object_or_404(request.user.alerts, pk=alert_id).delete()
    return ok()


@extend_schema(responses=OpenApiTypes.OBJECT)
@api_view(["GET"])
def history(request):
    """Past rides, newest first, and the numbers on Account. kmShared = km you travelled with a colleague:
    your part of the route as a guest, and the longest guest's part when you hosted."""
    user = request.user
    taken = list(Booking.objects.filter(guest=user, status="picked_up", ride__status="completed").select_related("ride__host"))
    given = Ride.objects.filter(host=user, status="completed").prefetch_related(
        Prefetch("bookings", Booking.objects.filter(status="picked_up").select_related("guest"), to_attr="riders"))
    rows, km_shared, rides_given = [], 0.0, 0
    for b in taken:
        km = geo.length_km(shared_part(b.ride, b.meet)[3])
        office = OFFICES[b.ride.office]["name"]
        ends = (b.meet_name, office) if b.ride.direction == "to_office" else (office, b.meet_name)
        rows.append({"role": "guest", "rideId": b.ride_id, "when": b.ride.depart_at, "from": ends[0], "to": ends[1],
                     "with": [display_name(b.ride.host)], "km": round(km, 1)})
        km_shared += km
    for r in given:
        if not r.riders:  # completed, but nobody came along
            continue
        km = max(geo.length_km(shared_part(r, b.meet)[3]) for b in r.riders)
        rows.append({"role": "host", "rideId": r.id, "when": r.depart_at, "from": r.start["name"], "to": r.end["name"],
                     "with": [display_name(b.guest) for b in r.riders], "km": round(km, 1)})
        km_shared += km
        rides_given += 1
    rows.sort(key=lambda row: row["when"], reverse=True)
    return Response({"stats": {"ridesTaken": len(taken), "ridesGiven": rides_given, "kmShared": round(km_shared)}, "rides": rows[:50]})
