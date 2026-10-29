import re
from datetime import timedelta

from django.core import mail
from django.core.cache import cache
from rest_framework.test import APITestCase

from .models import EmailCode, User

EMAIL = "asha.k@perficient.com"
PASSWORD = "Cpool1234"
BIKE = {"type": "bike", "number": "ka 05 mx-2231", "model": "Bajaj Pulsar 150", "mfgMonth": 2, "mfgYear": 2019, "seats": 1, "helmet": "host"}


class AuthFlowTests(APITestCase):
    def setUp(self):
        cache.clear()  # reset the rate limiter between tests

    def post(self, url, data, status=200):
        res = self.client.post(url, data, format="json")
        self.assertEqual(res.status_code, status, res.data)
        return res.data

    def last_code(self):
        return re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)

    def register(self, email=EMAIL, password=PASSWORD):
        self.post("/v1/auth/signup", {"email": email})
        token = self.post("/v1/auth/verify", {"email": email, "code": self.last_code(), "purpose": "signup"})["token"]
        self.post("/v1/auth/set-password", {"token": token, "password": password, "phone": "+919845012345"})

    def sign_in(self, email=EMAIL, password=PASSWORD):
        data = self.post("/v1/auth/login", {"email": email, "password": password})
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {data['token']}")
        return data

    def test_signup_to_host_setup(self):
        self.register(email="  Asha.K@Perficient.com ")  # trimmed and lower-cased
        first = self.sign_in()
        self.assertEqual((first["role"], first["vehicle"]), (None, None))  # first sign-in → first-time setup

        self.client.put("/v1/me", {"role": "host"}, format="json")
        vehicle = self.post("/v1/me/vehicles", BIKE, 201)
        self.assertEqual(vehicle["number"], "KA05MX2231")

        again = self.sign_in()
        self.assertEqual(again["role"], "host")
        self.assertEqual(again["vehicle"]["model"], "Bajaj Pulsar 150")
        me = self.client.get("/v1/me").data
        self.assertEqual((me["email"], me["role"]), (EMAIL, "host"))

    def test_only_work_emails(self):
        err = self.post("/v1/auth/signup", {"email": "asha@gmail.com"}, 400)
        self.assertEqual(err, {"code": "not_work_email", "message": "Use your Perficient email."})

    def test_signup_twice_and_login_errors(self):
        self.register()
        self.assertEqual(self.post("/v1/auth/signup", {"email": EMAIL}, 400)["code"], "already_registered")
        self.assertEqual(self.post("/v1/auth/login", {"email": EMAIL, "password": "nope1234"}, 400)["code"], "wrong_password")
        self.assertEqual(self.post("/v1/auth/login", {"email": "ravi@perficient.com", "password": PASSWORD}, 400)["code"], "not_registered")

    def test_wrong_codes_then_locked(self):
        self.post("/v1/auth/signup", {"email": EMAIL})
        good = self.last_code()
        bad = "000000" if good != "000000" else "111111"
        for _ in range(5):
            self.assertEqual(self.post("/v1/auth/verify", {"email": EMAIL, "code": bad, "purpose": "signup"}, 400)["code"], "wrong_code")
        # Even the right code is refused after 5 wrong tries.
        self.assertEqual(self.post("/v1/auth/verify", {"email": EMAIL, "code": good, "purpose": "signup"}, 400)["code"], "too_many_tries")

    def test_expired_code(self):
        self.post("/v1/auth/signup", {"email": EMAIL})
        EmailCode.objects.update(created=EmailCode.objects.get().created - timedelta(minutes=11))
        self.assertEqual(self.post("/v1/auth/verify", {"email": EMAIL, "code": self.last_code(), "purpose": "signup"}, 400)["code"], "code_expired")

    def test_forgot_does_not_reveal_accounts(self):
        self.post("/v1/auth/forgot", {"email": "nobody@perficient.com"})
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(self.post("/v1/auth/verify", {"email": "nobody@perficient.com", "code": "123456", "purpose": "reset"}, 400)["code"], "wrong_code")

    def test_reset_password_signs_out_everywhere(self):
        self.register()
        self.sign_in()
        self.post("/v1/auth/forgot", {"email": EMAIL})
        token = self.post("/v1/auth/verify", {"email": EMAIL, "code": self.last_code(), "purpose": "reset"})["token"]
        self.post("/v1/auth/set-password", {"token": token, "password": "NewPass99"})
        self.assertEqual(self.client.get("/v1/me").status_code, 401)  # old token is gone
        self.sign_in(password="NewPass99")

    def test_weak_password_and_bad_token(self):
        self.post("/v1/auth/signup", {"email": EMAIL})
        token = self.post("/v1/auth/verify", {"email": EMAIL, "code": self.last_code(), "purpose": "signup"})["token"]
        self.assertEqual(self.post("/v1/auth/set-password", {"token": token, "password": "short1", "phone": "9845012345"}, 400)["code"], "weak_password")
        self.assertEqual(self.post("/v1/auth/set-password", {"token": token, "password": "password1", "phone": "9845012345"}, 400)["code"], "weak_password")  # too common
        self.assertEqual(self.post("/v1/auth/set-password", {"token": "forged", "password": PASSWORD}, 400)["code"], "token_expired")

    def test_change_password_rotates_token(self):
        self.register()
        old = self.sign_in()["token"]
        self.assertEqual(self.post("/v1/me/password", {"current": "wrong123", "new": "Fresh2026"}, 400)["code"], "wrong_password")
        new = self.post("/v1/me/password", {"current": PASSWORD, "new": "Fresh2026"})["token"]
        self.assertNotEqual(old, new)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {old}")
        self.assertEqual(self.client.get("/v1/me").status_code, 401)

    def test_logout_and_auth_errors(self):
        res = self.client.get("/v1/me")
        self.assertEqual((res.status_code, res.data["code"]), (401, "not_authenticated"))
        self.register()
        self.sign_in()
        self.post("/v1/auth/logout", {})
        self.assertEqual(self.client.get("/v1/me").status_code, 401)

    def test_vehicle_rules(self):
        self.register()
        self.sign_in()
        err = self.post("/v1/me/vehicles", {**BIKE, "seats": 2}, 400)
        self.assertEqual((err["code"], list(err["fields"])), ("invalid", ["seats"]))
        self.assertEqual(list(self.post("/v1/me/vehicles", {**BIKE, "number": "HELLO123"}, 400)["fields"]), ["number"])
        car = self.post("/v1/me/vehicles", {**BIKE, "type": "car", "seats": 4, "helmet": "host"}, 201)
        self.assertIsNone(car["helmet"])  # helmets are only for bikes

    def test_disabled_account(self):
        self.register()
        User.objects.filter(username=EMAIL).update(is_active=False)
        self.assertEqual(self.post("/v1/auth/login", {"email": EMAIL, "password": PASSWORD}, 403)["code"], "account_disabled")

    def test_mobile_number_at_signup(self):
        self.post("/v1/auth/signup", {"email": EMAIL})
        token = self.post("/v1/auth/verify", {"email": EMAIL, "code": self.last_code(), "purpose": "signup"})["token"]
        self.assertEqual(self.post("/v1/auth/set-password", {"token": token, "password": PASSWORD}, 400)["code"], "phone_required")
        self.assertEqual(self.post("/v1/auth/set-password", {"token": token, "password": PASSWORD, "phone": "12345"}, 400)["code"], "invalid_phone")
        self.assertEqual(self.post("/v1/auth/set-password", {"token": token, "password": PASSWORD, "phone": "5845012345"}, 400)["code"], "invalid_phone")  # must start 6-9
        self.post("/v1/auth/set-password", {"token": token, "password": PASSWORD, "phone": " 98450-12345"})
        self.sign_in()
        self.assertEqual(self.client.get("/v1/me").data["phone"], "+919845012345")  # stored in one format

        res = self.client.patch("/v1/me", {"phone": "hello"}, format="json")
        self.assertEqual((res.status_code, list(res.data["fields"])), (400, ["phone"]))
        self.assertEqual(self.client.patch("/v1/me", {"phone": "+91 70000 00001"}, format="json").data["phone"], "+917000000001")
