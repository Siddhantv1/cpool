"""Push notifications through Expo's push service: one free HTTPS call that reaches Android (via Firebase) and iPhone
(via Apple), using the Expo push token each phone registers with PUT /v1/me/devices. No extra library."""

import json
import logging
import threading
import urllib.request

from django.conf import settings
from django.db import connection, transaction

from .models import Alert, Device

EXPO_URL = "https://exp.host/--/api/v2/push/send"
log = logging.getLogger("cpool.push")

# Per alert kind: Android channel and notification category (its buttons), as the app's notify.js expects (cmem-A A17, A23).
STYLE = {
    "request": ("requests", "seat-request"),
    "accepted": ("ride", "ride-accepted"),
    "declined": ("ride", "find"),
    "cancelled": ("ride", "ride-cancelled"),
    "in_car": ("guests", "guest-in-car"),
}


def message_for(alert, token):
    """The Expo push message for one alert on one phone; `data` tells the app which screen to open."""
    booking = alert.booking
    to_host = booking is not None and alert.user_id == booking.ride.host_id
    channel, category = STYLE.get(alert.kind, ("ride", None))
    data = {"kind": alert.kind, "alertId": alert.id, "bookingId": alert.booking_id, "rideId": alert.ride_id}
    if alert.kind == "request":
        data.update(url={"pathname": "/request", "params": {"id": alert.booking_id}}, reqId=alert.booking_id)
    elif alert.kind == "accepted":
        data.update(url="/accepted", phone=booking.ride.host.phone or None)
    elif alert.kind == "declined":
        data.update(url="/results")
    elif alert.kind == "cancelled" and to_host:  # a guest withdrew or cancelled their seat
        channel, category = "requests", None
        data.update(url="/home")
    elif alert.kind == "cancelled":  # the host cancelled the ride (or it never went ahead)
        data.update(url="/cancelled", reason=booking.reason)
    elif alert.kind == "in_car":
        data.update(url="/drive", guestId=alert.booking_id)
    message = {"to": token, "title": alert.title, "body": alert.text, "data": data, "sound": "default",
               "channelId": channel, "priority": "high"}
    if category:
        message["categoryId"] = category
    return message


def push(alert):
    """Send this alert to the user's phones, once the database change is saved, in the background (never slows the request).
    ponytail: one short thread per alert; move to a job queue if pushes ever pile up."""
    if settings.PUSH_ENABLED:
        transaction.on_commit(lambda: threading.Thread(target=send_in_background, args=(alert.pk,), daemon=True).start())


def send_in_background(alert_id):
    try:
        send(alert_id)
    finally:
        connection.close()  # the thread's own database connection


def send(alert_id, post=None):
    try:
        alert = Alert.objects.select_related("booking__ride__host").get(pk=alert_id)
        messages = [message_for(alert, d.token) for d in Device.objects.filter(user_id=alert.user_id)]
        if messages:
            forget_dead(messages, (post or post_to_expo)(messages))
    except Exception:  # a push is a nice extra: the alert is already saved and the app also polls
        log.exception("push for alert %s failed", alert_id)


def post_to_expo(messages):
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if settings.EXPO_ACCESS_TOKEN:  # only if "enhanced push security" is turned on in the Expo project
        headers["Authorization"] = f"Bearer {settings.EXPO_ACCESS_TOKEN}"
    request = urllib.request.Request(EXPO_URL, data=json.dumps(messages).encode(), headers=headers, method="POST")
    with urllib.request.urlopen(request, timeout=10) as reply:
        return json.load(reply)


def forget_dead(messages, reply):
    """Expo answers one ticket per message, in order; a phone that uninstalled Cpool is "DeviceNotRegistered"."""
    for message, ticket in zip(messages, reply.get("data", [])):
        if ticket.get("status") == "error" and ticket.get("details", {}).get("error") == "DeviceNotRegistered":
            Device.objects.filter(token=message["to"]).delete()
