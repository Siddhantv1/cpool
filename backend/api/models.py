import hashlib
import hmac

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    # username holds the lower-case work email (email mirrors it), so Django's admin and login keep working.
    role = models.CharField(max_length=5, choices=[("guest", "Guest"), ("host", "Host")], null=True, blank=True)
    name = models.CharField(max_length=40, blank=True)
    gender = models.CharField(max_length=20, blank=True)


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

    class Meta:
        ordering = ["created"]  # the first vehicle is the default one

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
