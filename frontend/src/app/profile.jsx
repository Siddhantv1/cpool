import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import Button from "../components/Button";
import OptionCard from "../components/OptionCard";
import Screen from "../components/Screen";
import { useTheme } from "../constants/theme";
import { setRole } from "../lib/api";
import { resetDraft } from "../lib/onboarding";
import { clearSession, getSession, updateSession } from "../lib/session";

// "aswin.v@perficient.com" -> "Aswin V"
const displayName = (email) =>
  email
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

export default function Profile() {
  const session = getSession();
  const { colors, spacing, fontSize, radius } = useTheme();
  const [role, setLocalRole] = useState(session?.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!session) return <Redirect href="/welcome" />;

  async function switchTo(next) {
    if (next === role || saving) return;
    // First time as a host: add a vehicle first, starting from Bike or Car. The role is saved at the end of that setup.
    if (next === "host" && !session.vehicle) {
      resetDraft();
      router.push("/vehicle-type");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await setRole(session.email, next);
      updateSession({ role: next });
      setLocalRole(next);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function onLogOut() {
    clearSession();
    if (router.canDismiss()) router.dismissAll();
    router.replace("/welcome");
  }

  const name = displayName(session.email);
  const vehicle = session.vehicle;

  return (
    <Screen back title="Profile" footer={<Button title="Log out" variant="secondary" onPress={onLogOut} />}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <View style={{ width: 56, height: 56, borderRadius: radius.pill, backgroundColor: colors.primarySurface, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.primary, fontSize: fontSize.lg, fontWeight: "800" }}>{name.charAt(0)}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: "800" }}>{name}</Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{session.email}</Text>
        </View>
      </View>

      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: fontSize.md, fontWeight: "800", marginTop: spacing.sm }}>
        How you use Cpool
      </Text>
      <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup">
        <OptionCard
          icon={<Ionicons name="person-outline" size={22} color={colors.primary} />}
          title="Guest"
          description="Find rides with colleagues"
          selected={role === "guest"}
          onPress={() => switchTo("guest")}
        />
        <OptionCard
          icon={<Ionicons name="car-outline" size={22} color={colors.success} />}
          title="Host"
          description={vehicle ? "Offer seats in your vehicle" : "Add your bike or car to offer seats"}
          selected={role === "host"}
          onPress={() => switchTo("host")}
        />
      </View>
      {error ? <Text style={{ color: colors.error, fontSize: fontSize.sm }}>{error}</Text> : null}

      {vehicle ? (
        <>
          <Text accessibilityRole="header" style={{ color: colors.text, fontSize: fontSize.md, fontWeight: "800", marginTop: spacing.sm }}>
            Your vehicle
          </Text>
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md }}
            accessible
            accessibilityLabel={`${vehicle.model}, ${vehicle.number}`}
          >
            <MaterialCommunityIcons name={vehicle.type === "bike" ? "motorbike" : "car-side"} size={28} color={colors.primary} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: "700" }}>{vehicle.model}</Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{[vehicle.number, vehicle.colour].filter(Boolean).join(" · ")}</Text>
            </View>
          </View>
        </>
      ) : null}
    </Screen>
  );
}
