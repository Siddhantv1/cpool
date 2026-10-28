# Kept apart from views.py: DRF imports auth classes while it is still loading rest_framework.views.
from rest_framework.authentication import TokenAuthentication


class BearerAuth(TokenAuthentication):
    keyword = "Bearer"  # Authorization: Bearer <token>
