from django.contrib import admin
from django.urls import path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from api import views

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema")),
    path("v1/auth/signup", views.signup),
    path("v1/auth/forgot", views.forgot),
    path("v1/auth/verify", views.verify),
    path("v1/auth/set-password", views.set_password),
    path("v1/auth/login", views.login),
    path("v1/auth/logout", views.logout),
    path("v1/me", views.me),
    path("v1/me/password", views.change_password),
    path("v1/me/vehicles", views.vehicles),
]
