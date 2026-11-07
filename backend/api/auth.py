# Kept apart from views.py: DRF imports auth classes while it is still loading rest_framework.views.
from datetime import timedelta

from django.utils import timezone
from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import AuthenticationFailed

SESSION_IDLE = timedelta(days=60)  # a login ends after this long without using the app


class BearerAuth(TokenAuthentication):
    keyword = "Bearer"  # Authorization: Bearer <token>

    def authenticate_credentials(self, key):
        user, token = super().authenticate_credentials(key)
        now = timezone.now()
        if user.last_active and now - user.last_active > SESSION_IDLE:
            token.delete()
            user.devices.all().delete()  # a signed-out phone shouldn't keep getting this account's pushes
            raise AuthenticationFailed("You were signed out after 60 days without using Cpool. Please sign in again.", code="session_expired")
        if not user.last_active or now - user.last_active > timedelta(hours=1):
            type(user).objects.filter(pk=user.pk).update(last_active=now)  # at most one database write an hour
        return user, token
