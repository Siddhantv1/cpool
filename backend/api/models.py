import hashlib
import hmac

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    # username holds the lower-case work email (email mirrors it), so Django's admin and login keep working.
    role = models.CharField(max_length=5, choices=[("guest", "Guest"), ("host", "Host")], null=True, blank=True)
    name = models.CharField(max_length=40, blank=True)
    gender = models.CharField(max_length=20, blank=True)
    phone = models.CharField(max_length=16, blank=True)  # shown to the other person only once a seat is confirmed
    default_vehicle = models.ForeignKey("Vehicle", on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    last_active = models.DateTimeField(null=True, blank=True)  # last signed-in use; a login ends after 60 days without one

    def active_vehicles(self):
        return self.vehicles.filter(removed=False)

    def vehicle(self):
        """The default vehicle: the one picked in the app, else the first one added."""
        v = self.default_vehicle
        return v if v and not v.removed else self.active_vehicles().first()


class Vehicle(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="vehicles")
    type = models.CharField(max_length=4, choices=[("bike", "Bike"), ("car", "Car")])
    number = models.CharField(max_length=12)
    model = models.CharField(max_length=60)
    mfg_month = models.PositiveSmallIntegerField()
    mfg_year = models.PositiveSmallIntegerField()
    colour = models.CharField(max_length=30, blank=True)
    seats = models.PositiveSmallIntegerField()  # guest seats: bike 1, car 1-7
    helmet = models.CharField(max_length=5, choices=[("host", "Host carries a spare"), ("guest", "Guest brings own")], null=True, blank=True)
    created = models.DateTimeField(auto_now_add=True)
    # Removed vehicles stay in the database so past rides can still show them; the app never sees them again.
    removed = models.BooleanField(default=False)

    class Meta:
        ordering = ["created"]
        # A car or bike can be on only one active account at a time; removing it (or deleting the account) frees the plate.
        constraints = [models.UniqueConstraint(fields=["number"], condition=models.Q(removed=False), name="one_active_vehicle_per_plate")]

    def __str__(self):
        return f"{self.number} · {self.model}"


class EmailCode(models.Model):
    """A 6-digit code sent to a work email to sign up or reset a password. Only its hash is stored."""

    email = models.EmailField()
    purpose = models.CharField(max_length=6, choices=[("signup", "Sign up"), ("reset", "Reset password")])
    code_hash = models.CharField(max_length=64)
    tries = models.PositiveSmallIntegerField(default=0)
    created = models.DateTimeField(auto_now_add=True)

    @staticmethod
    def hash(code):
        return hmac.new(settings.SECRET_KEY.encode(), code.encode(), hashlib.sha256).hexdigest()

    def __str__(self):
        return f"{self.email} · {self.purpose}"


# The two offices. Every ride starts or ends at one of them; the server uses these coordinates, not the app's.
# ponytail: hard-coded; make an Office model editable in the admin when a third office opens.
OFFICES = {
    "bellandur": {"name": "Perficient Bellandur", "coords": [77.6914, 12.9307]},
    "whitefield": {"name": "Perficient Whitefield", "coords": [77.73, 12.985]},
}

# A guest's booking ties them up while in one of these states AND its ride is still open or started
# (a "picked_up" booking on a completed ride is history, not a current trip).
ACTIVE_BOOKING = ["requested", "accepted", "picked_up"]
ACTIVE_RIDE = ["open", "started"]


class Ride(models.Model):
    """A host's offer: from → to (one end is an office), when, how many seats, and the road route."""

    host = models.ForeignKey(User, on_delete=models.CASCADE, related_name="rides")
    vehicle = models.ForeignKey(Vehicle, on_delete=models.PROTECT, related_name="rides")
    office = models.CharField(max_length=12, choices=[(k, v["name"]) for k, v in OFFICES.items()])
    direction = models.CharField(max_length=11, choices=[("to_office", "To the office"), ("from_office", "From the office")])
    start = models.JSONField()  # {name, coords: [lng, lat]}
    end = models.JSONField()
    # ponytail: route comes from the app's Mapbox Directions call; check Mapbox's terms on storing it (Siddhant's validation task).
    route = models.JSONField()  # [[lng, lat], ...]
    depart_at = models.DateTimeField()
    seats_total = models.PositiveSmallIntegerField()
    seats_left = models.PositiveSmallIntegerField()
    status = models.CharField(max_length=9, default="open", choices=[(s, s) for s in ["open", "started", "completed", "cancelled"]])
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["depart_at"]
        constraints = [models.UniqueConstraint(fields=["host"], condition=models.Q(status__in=ACTIVE_RIDE), name="one_active_ride_per_host")]

    def __str__(self):
        return f"{self.host.username} · {self.direction} {self.office} · {self.depart_at:%d %b %H:%M}"


class Booking(models.Model):
    """A guest's seat request on a ride, with where they meet the host."""

    STATUSES = ["requested", "accepted", "declined", "withdrawn", "cancelled", "picked_up", "no_show"]
    ride = models.ForeignKey(Ride, on_delete=models.CASCADE, related_name="bookings")
    guest = models.ForeignKey(User, on_delete=models.CASCADE, related_name="bookings")
    meet = models.JSONField()  # [lng, lat] where the guest joins (to office) or leaves (from office) the route
    meet_name = models.CharField(max_length=120)
    status = models.CharField(max_length=9, default="requested", choices=[(s, s) for s in STATUSES])
    reason = models.CharField(max_length=140, blank=True)
    # Picked up counts when both say so: the host taps "Picked up", the guest taps "I'm in the car". Neither waits for the other.
    host_confirmed_at = models.DateTimeField(null=True, blank=True)
    guest_confirmed_at = models.DateTimeField(null=True, blank=True)
    flagged = models.BooleanField(default=False)  # host tried "No-show" after the guest said they were in the car: admin to check
    created = models.DateTimeField(auto_now_add=True)
    status_changed = models.DateTimeField(default=timezone.now)  # when the status last changed (e.g. when it was declined)

    class Meta:
        ordering = ["created"]
        # Backs up "one seat request at a time" even if two requests arrive at the same moment. (Only requested/accepted:
        # "picked_up" stays on finished rides as history, so it can't be part of a database-level rule.)
        constraints = [models.UniqueConstraint(fields=["guest"], condition=models.Q(status__in=["requested", "accepted"]), name="one_active_booking_per_guest")]

    def __str__(self):
        return f"{self.guest.username} on ride {self.ride_id} · {self.status}"


class Location(models.Model):
    """Last known position of one person on one ride (sent every few seconds while the trip is live)."""

    ride = models.ForeignKey(Ride, on_delete=models.CASCADE, related_name="locations")
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    coords = models.JSONField()
    heading = models.FloatField(null=True, blank=True)
    at_meet_point = models.BooleanField(default=False)  # the guest's phone says it's within 50 m of the meet point
    at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["ride", "user"], name="one_location_per_person_per_ride")]


class Sos(models.Model):
    ride = models.ForeignKey(Ride, on_delete=models.SET_NULL, null=True, blank=True, related_name="sos")
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    coords = models.JSONField(null=True, blank=True)
    created = models.DateTimeField(auto_now_add=True)
    handled = models.BooleanField(default=False)

    class Meta:
        verbose_name_plural = "SOS alerts"

    def __str__(self):
        return f"SOS from {self.user.username} at {self.created:%d %b %H:%M}"


class Alert(models.Model):
    """One line in the app's Alerts tab. Created when something happens to your ride or seat request."""

    KINDS = ["request", "accepted", "declined", "cancelled", "in_car"]  # the app's Alerts tab kinds, plus "in_car" (guest says they're in the car)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="alerts")
    kind = models.CharField(max_length=9, choices=[(k, k) for k in KINDS])
    title = models.CharField(max_length=120)
    text = models.CharField(max_length=200)
    who = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")  # the other person
    ride = models.ForeignKey(Ride, on_delete=models.CASCADE, null=True, blank=True, related_name="+")
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, null=True, blank=True, related_name="+")
    read = models.BooleanField(default=False)
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created", "-id"]

    def __str__(self):
        return f"{self.user.username}: {self.title}"


class Device(models.Model):
    """A phone that gets push notifications: its Expo push token. A token belongs to whoever registered it last."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="devices")
    token = models.CharField(max_length=200, unique=True)
    platform = models.CharField(max_length=7, choices=[("android", "Android"), ("ios", "iPhone")])
    created = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} · {self.platform}"
