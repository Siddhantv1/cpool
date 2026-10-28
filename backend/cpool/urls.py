from django.contrib import admin
from django.urls import path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from api import rides, views

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
    path("v1/me/trip", rides.my_trip),
    path("v1/rides", rides.offer),
    path("v1/rides/search", rides.search),
    path("v1/rides/<int:ride_id>/start", rides.start_ride),
    path("v1/rides/<int:ride_id>/complete", rides.complete_ride),
    path("v1/rides/<int:ride_id>/cancel", rides.cancel_ride),
    path("v1/rides/<int:ride_id>/bookings", rides.request_seat),
    path("v1/rides/<int:ride_id>/locations", rides.send_location),
    path("v1/rides/<int:ride_id>/live", rides.live),
    path("v1/rides/<int:ride_id>/sos", rides.sos),
    path("v1/bookings/<int:booking_id>/accept", rides.accept),
    path("v1/bookings/<int:booking_id>/reject", rides.reject),
    path("v1/bookings/<int:booking_id>/cancel", rides.cancel_booking),
    path("v1/bookings/<int:booking_id>/picked-up", rides.picked_up),
    path("v1/bookings/<int:booking_id>/no-show", rides.no_show),
]
