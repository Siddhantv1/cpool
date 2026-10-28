from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Booking, EmailCode, Ride, Sos, User, Vehicle


@admin.register(User)
class CpoolUserAdmin(UserAdmin):
    # Untick "Active" to switch off someone who has left Perficient.
    list_display = ["username", "name", "role", "is_active", "date_joined"]
    list_filter = ["role", "is_active"]
    fieldsets = UserAdmin.fieldsets + (("Cpool", {"fields": ["role", "name", "gender", "phone"]}),)


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ["number", "model", "type", "seats", "owner"]
    search_fields = ["number", "owner__username"]


@admin.register(EmailCode)
class EmailCodeAdmin(admin.ModelAdmin):
    list_display = ["email", "purpose", "tries", "created"]


class BookingInline(admin.TabularInline):
    model = Booking
    fields = ["guest", "status", "meet_name", "reason", "created"]
    readonly_fields = ["created"]
    extra = 0


@admin.register(Ride)
class RideAdmin(admin.ModelAdmin):
    list_display = ["id", "host", "office", "direction", "depart_at", "seats_left", "seats_total", "status"]
    list_filter = ["status", "office", "direction"]
    exclude = ["route"]  # long list of points; not useful to read here
    inlines = [BookingInline]


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ["id", "guest", "ride", "status", "meet_name", "created"]
    list_filter = ["status"]


@admin.register(Sos)
class SosAdmin(admin.ModelAdmin):
    # Security desk view: newest first; tick "handled" once someone has responded.
    list_display = ["created", "user", "ride", "coords", "handled"]
    list_filter = ["handled"]
    list_editable = ["handled"]
