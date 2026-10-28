from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import EmailCode, User, Vehicle


@admin.register(User)
class CpoolUserAdmin(UserAdmin):
    # Untick "Active" to switch off someone who has left Perficient.
    list_display = ["username", "name", "role", "is_active", "date_joined"]
    list_filter = ["role", "is_active"]
    fieldsets = UserAdmin.fieldsets + (("Cpool", {"fields": ["role", "name", "gender"]}),)


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ["number", "model", "type", "seats", "owner"]
    search_fields = ["number", "owner__username"]


@admin.register(EmailCode)
class EmailCodeAdmin(admin.ModelAdmin):
    list_display = ["email", "purpose", "tries", "created"]
