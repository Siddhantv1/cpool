"""Cpool API: sign-up / sign-in with work-email codes, and the signed-in user's profile and vehicles.
Routes and shapes follow the API table in the repo README."""

import hmac
import re
import secrets
from datetime import timedelta

from django.contrib.auth.password_validation import validate_password
from django.core import signing
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.db.models import F
from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import exception_handler

from .models import EmailCode, User, Vehicle

CODE_MINUTES = 10
CODE_TRIES = 5
SET_PASSWORD_SECONDS = 15 * 60
WORK_EMAIL = re.compile(r"^[^\s@]+@perficient\.com$", re.I)
PLATE = re.compile(r"^([A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}|\d{2}BH\d{4}[A-Z]{1,2})$")  # KL34B3211, 22BH1234AA


# ---------- plumbing: error shape and helpers ----------

class ApiError(APIException):
    def __init__(self, code, message, status=400):
        super().__init__(message, code)
        self.status_code = status


def error_handler(exc, context):
    """Every error is {code, message}; validation errors add fields: {name: message}."""
    response = exception_handler(exc, context)
    if response is None:
        return None
    if isinstance(exc, ValidationError):
        data = response.data if isinstance(response.data, dict) else {"detail": response.data}
        fields = {k: str(v[0] if isinstance(v, list) else v) for k, v in data.items()}
        response.data = {"code": "invalid", "message": next(iter(fields.values()), "Check the details."), "fields": fields}
    else:
        code = exc.get_codes() if isinstance(exc, APIException) else "not_found"
        response.data = {"code": code, "message": str(response.data.get("detail", ""))}
    return response


def ok(**extra):
    return Response({"ok": True, **extra})


def work_email(value):
    email = (value or "").strip().lower()
    if not WORK_EMAIL.match(email):
        raise ApiError("not_work_email", "Use your Perficient email.")
    return email


def check_password_rules(password, user=None):
    if len(password) < 8 or not re.search(r"[a-z]", password, re.I) or not re.search(r"\d", password):
        raise ApiError("weak_password", "Use at least 8 characters with a letter and a number.")
    try:
        validate_password(password, user)
    except DjangoValidationError as e:
        raise ApiError("weak_password", e.messages[0])


def send_code(email, purpose):
    code = f"{secrets.randbelow(10**6):06d}"
    EmailCode.objects.filter(email=email, purpose=purpose).delete()
    EmailCode.objects.create(email=email, purpose=purpose, code_hash=EmailCode.hash(code))
    send_mail("Your Cpool code", f"Your Cpool code is {code}. It expires in {CODE_MINUTES} minutes.", None, [email])


class AuthThrottle(AnonRateThrottle):
    scope = "auth"  # rate in settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"], per IP


def body(name, fields):
    """Request/response shape for Swagger (these views read request.data directly)."""
    return inline_serializer(name, fields)


OK = body("Ok", {"ok": serializers.BooleanField()})


def auth_view(request_fields, response=OK):
    """Public auth route: no token needed, rate-limited, request body documented in Swagger."""
    def wrap(fn):
        # No authentication at all: a stale token left on the phone must not block signing in again.
        view = api_view(["POST"])(authentication_classes([])(permission_classes([AllowAny])(throttle_classes([AuthThrottle])(fn))))
        return extend_schema(request=body(fn.__name__ + "_body", request_fields), responses=response)(view)
    return wrap


# ---------- auth ----------

@auth_view({"email": serializers.EmailField()})
def signup(request):
    email = work_email(request.data.get("email"))
    if User.objects.filter(username=email).exists():
        raise ApiError("already_registered", "An account with this email already exists. Sign in instead.")
    send_code(email, "signup")
    return ok()


@auth_view({"email": serializers.EmailField()})
def forgot(request):
    email = work_email(request.data.get("email"))
    # Same answer whether or not the account exists, so nobody can probe for accounts.
    if User.objects.filter(username=email, is_active=True).exists():
        send_code(email, "reset")
    return ok()


@auth_view({"email": serializers.EmailField(), "code": serializers.CharField(), "purpose": serializers.ChoiceField(["signup", "reset"])},
           body("VerifyResult", {"token": serializers.CharField()}))
def verify(request):
    email = work_email(request.data.get("email"))
    purpose = request.data.get("purpose")
    code = str(request.data.get("code", "")).strip()
    row = EmailCode.objects.filter(email=email, purpose=purpose).first()
    # No code on file (e.g. forgot-password for an unknown email) looks the same as a wrong code.
    if not row:
        raise ApiError("wrong_code", "That code is wrong. Check your email and try again.")
    if row.created < timezone.now() - timedelta(minutes=CODE_MINUTES):
        raise ApiError("code_expired", "This code has expired. Ask for a new one.")
    if row.tries >= CODE_TRIES:
        raise ApiError("too_many_tries", "Too many wrong codes. Ask for a new one.")
    if not hmac.compare_digest(row.code_hash, EmailCode.hash(code)):
        EmailCode.objects.filter(pk=row.pk).update(tries=F("tries") + 1)
        raise ApiError("wrong_code", "That code is wrong. Check your email and try again.")
    row.delete()
    return Response({"token": signing.dumps({"email": email, "purpose": purpose}, salt="set-password")})


@auth_view({"token": serializers.CharField(), "password": serializers.CharField()})
def set_password(request):
    try:
        data = signing.loads(request.data.get("token", ""), salt="set-password", max_age=SET_PASSWORD_SECONDS)
    except signing.BadSignature:  # also covers an expired token
        raise ApiError("token_expired", "This link has expired. Please start again.")
    password = request.data.get("password", "")
    email = data["email"]
    if data["purpose"] == "signup":
        if User.objects.filter(username=email).exists():
            raise ApiError("already_registered", "An account with this email already exists. Sign in instead.")
        check_password_rules(password, User(username=email, email=email))
        User.objects.create_user(username=email, email=email, password=password)
    else:
        user = User.objects.filter(username=email).first()
        if not user:
            raise ApiError("token_expired", "This link has expired. Please start again.")
        check_password_rules(password, user)
        user.set_password(password)
        user.save()
        Token.objects.filter(user=user).delete()  # sign out everywhere after a reset
    return ok()


@auth_view({"email": serializers.EmailField(), "password": serializers.CharField()},
           body("LoginResult", {"token": serializers.CharField(), "role": serializers.CharField(allow_null=True), "vehicle": serializers.DictField(allow_null=True)}))
def login(request):
    email = work_email(request.data.get("email"))
    user = User.objects.filter(username=email).first()
    if not user:
        raise ApiError("not_registered", "No account found for this email.")
    if not user.check_password(request.data.get("password", "")):
        raise ApiError("wrong_password", "Email or password is incorrect.")
    if not user.is_active:
        raise ApiError("account_disabled", "This account is turned off. Contact the Cpool admin.", 403)
    # ponytail: one token per user, shared by all their phones; logging out on one logs out all. Use django-rest-knox if that bites.
    token, _ = Token.objects.get_or_create(user=user)
    vehicle = user.vehicles.first()
    return Response({"token": token.key, "role": user.role, "vehicle": VehicleSerializer(vehicle).data if vehicle else None})


@extend_schema(request=None, responses=OK)
@api_view(["POST"])
def logout(request):
    Token.objects.filter(user=request.user).delete()
    return ok()


# ---------- me ----------

class VehicleSerializer(serializers.ModelSerializer):
    number = serializers.CharField(max_length=20)  # raw input may have spaces/dashes; stored normalized (max 12)
    mfgMonth = serializers.IntegerField(source="mfg_month", min_value=1, max_value=12)
    mfgYear = serializers.IntegerField(source="mfg_year", min_value=1990)
    colour = serializers.CharField(required=False, allow_blank=True, allow_null=True, default="")

    class Meta:
        model = Vehicle
        fields = ["id", "type", "number", "model", "mfgMonth", "mfgYear", "colour", "seats", "helmet"]

    def validate_number(self, value):
        plate = re.sub(r"[^A-Z0-9]", "", value.upper())
        if not PLATE.match(plate):
            raise serializers.ValidationError("Check the number. It should look like KL34B3211 or 22BH1234AA.")
        return plate

    def validate_mfgYear(self, value):
        if value > timezone.now().year:
            raise serializers.ValidationError("The year can't be in the future.")
        return value

    def validate(self, data):
        data["colour"] = data.get("colour") or ""
        if data["type"] == "bike":
            if data["seats"] != 1:
                raise serializers.ValidationError({"seats": "A bike has 1 guest seat."})
            if data.get("helmet") not in ("host", "guest"):
                raise serializers.ValidationError({"helmet": "Say who brings the pillion helmet."})
        else:
            if not 1 <= data["seats"] <= 7:
                raise serializers.ValidationError({"seats": "A car can offer 1 to 7 guest seats."})
            data["helmet"] = None
        return data


class MeSerializer(serializers.ModelSerializer):
    name = serializers.CharField(min_length=2, max_length=40, required=False)
    phone = serializers.RegexField(r"^\+?\d{10,15}$", required=False, allow_blank=True, error_messages={"invalid": "Enter a phone number like +919876543210."})
    vehicle = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["email", "name", "gender", "phone", "role", "vehicle"]
        read_only_fields = ["email"]

    def get_vehicle(self, user) -> dict | None:
        vehicle = user.vehicles.first()
        return VehicleSerializer(vehicle).data if vehicle else None


@extend_schema(request=MeSerializer, responses=MeSerializer)
@api_view(["GET", "PUT", "PATCH"])
def me(request):
    if request.method == "GET":
        return Response(MeSerializer(request.user).data)
    # PUT and PATCH both change only the fields sent ({role} at first-time setup, {name, gender} from Edit profile).
    s = MeSerializer(request.user, data=request.data, partial=True)
    s.is_valid(raise_exception=True)
    s.save()
    return Response(s.data)


@extend_schema(request=body("change_password_body", {"current": serializers.CharField(), "new": serializers.CharField()}),
               responses=body("ChangePasswordResult", {"ok": serializers.BooleanField(), "token": serializers.CharField()}))
@api_view(["POST"])
def change_password(request):
    user = request.user
    if not user.check_password(request.data.get("current", "")):
        raise ApiError("wrong_password", "Your current password is incorrect.")
    new = request.data.get("new", "")
    if new == request.data.get("current"):
        raise ApiError("weak_password", "Choose a password different from your current one.")
    check_password_rules(new, user)
    user.set_password(new)
    user.save()
    # Sign out other phones: replace the token and hand this phone the new one.
    Token.objects.filter(user=user).delete()
    return ok(token=Token.objects.create(user=user).key)


@extend_schema(request=VehicleSerializer, responses=VehicleSerializer(many=True))
@api_view(["GET", "POST"])
def vehicles(request):
    if request.method == "GET":
        return Response(VehicleSerializer(request.user.vehicles.all(), many=True).data)
    s = VehicleSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    s.save(owner=request.user)
    return Response(s.data, status=201)
