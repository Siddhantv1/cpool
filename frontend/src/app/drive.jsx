import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LiveMap from "../components/LiveMap";
import { ActionRow, Avatar, call, MapSheet, RoundButton, SosButton } from "../components/RideUI";
import { useTheme } from "../constants/theme";
import { AGARA_INDEX, OFFICES, ROUTE } from "../lib/mock";
import { finishHosting, useTrips } from "../lib/trips";
import { useMovement } from "../lib/useMovement";

const TO_PICKUP = ROUTE.slice(0, AGARA_INDEX + 1);
const TO_OFFICE = ROUTE.slice(AGARA_INDEX);
// shortcut: example turn-by-turn steps; real ones should come from the Mapbox Directions API.
const STEPS_PICKUP = [
  { until: 0.35, dist: "1.2 km", text: "Continue on Hosur Rd", icon: "arrow-up" },
  { until: 0.7, dist: "800 m", text: "Turn right onto 27th Main", icon: "arrow-right-top" },
  { until: 0.95, dist: "300 m", text: "Turn left onto Outer Ring Rd", icon: "arrow-left-top" },
  { until: 1.01, dist: "Here", text: "Pick up at Agara junction", icon: "map-marker" },
];
const STEPS_OFFICE = [
  { until: 0.6, dist: "2.4 km", text: "Continue on Outer Ring Rd", icon: "arrow-up" },
  { until: 0.95, dist: "500 m", text: "Turn left to Embassy Tech Village", icon: "arrow-left-top" },
  { until: 1.01, dist: "Here", text: "Arrived at Perficient Bellandur", icon: "flag-checkered" },
];

function openGoogleMaps([lng, lat]) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  Linking.openURL(url).catch(() => Alert.alert("Can't open Google Maps"));
}

// You're the host: drive to the pickup, then to the office.
export default function Drive() {
  const { colors, spacing, fontSize, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { passenger } = useTrips();
  const [leg, setLeg] = useState("pickup"); // pickup → office
  const [arrived, setArrived] = useState(false);
  const coords = leg === "pickup" ? TO_PICKUP : TO_OFFICE;
  const move = useMovement(coords, leg === "pickup" ? 20000 : 22000, { onArrive: () => setArrived(true) });
  if (!passenger) return <Redirect href="/home" />;

  const steps = leg === "pickup" ? STEPS_PICKUP : STEPS_OFFICE;
  const step = steps.find((s) => move.t < s.until) ?? steps[steps.length - 1];
  const target = leg === "pickup" ? ROUTE[AGARA_INDEX] : OFFICES[0].coords;
  const pins = leg === "pickup" ? [{ id: "pickup", kind: "pickup", coords: ROUTE[AGARA_INDEX] }, { id: "office", kind: "office", coords: OFFICES[0].coords }] : [{ id: "office", kind: "office", coords: OFFICES[0].coords }];

  function nextLeg() {
    setArrived(false);
    setLeg("office");
  }
  function complete() {
    finishHosting();
    router.replace("/home");
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <LiveMap key={leg} route={ROUTE} done={leg === "office" ? [...TO_PICKUP, ...move.done] : move.done} pins={pins} vehicle={{ point: move.point, heading: move.heading, self: true }} />
      </View>

      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.md }} accessibilityLiveRegion="polite">
        <View style={{ backgroundColor: colors.green, borderTopLeftRadius: radius.lg + 2, borderTopRightRadius: radius.lg + 2, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: colors.onImageInk + "2E", alignItems: "center", justifyContent: "center" }}>
            <MaterialCommunityIcons name={step.icon} size={28} color={colors.onGreen} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.onGreen, fontSize: 24, fontWeight: "800" }}>{step.dist}</Text>
            <Text style={{ color: colors.onGreen, fontWeight: "700" }} numberOfLines={1}>{step.text}</Text>
          </View>
        </View>
        <View style={{ backgroundColor: colors.green, opacity: 0.85, borderBottomLeftRadius: radius.md + 2, borderBottomRightRadius: radius.md + 2, marginTop: 2, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: colors.onGreen, fontSize: 12, fontWeight: "600" }}>{leg === "pickup" ? `Then pick up ${passenger.name.split(" ")[0]}` : "Then drop at the office"}</Text>
          <Text style={{ color: colors.onGreen, fontSize: 12, fontWeight: "600" }}>{Math.max(1, Math.round((1 - move.t) * (leg === "pickup" ? 8 : 10)))} min</Text>
        </View>
      </View>

      <View style={{ position: "absolute", right: spacing.md, top: insets.top + 140, gap: spacing.sm, alignItems: "center" }}>
        <SosButton />
        <RoundButton label="Navigate with Google Maps" onPress={() => openGoogleMaps(target)} background={colors.primary} icon={<MaterialCommunityIcons name="navigation-variant" size={22} color={colors.onPrimary} />} />
        <Text style={{ color: colors.text, backgroundColor: colors.background, fontSize: 10, fontWeight: "700", paddingHorizontal: 5, borderRadius: 6, overflow: "hidden" }}>Google Maps</Text>
      </View>

      <View style={{ flex: 1 }} />
      <MapSheet>
        {leg === "pickup" ? (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md }}>Next pickup</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "600" }}>1 of 1</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Avatar initials={passenger.initials} color="#7C3AED" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md }}>{passenger.name}</Text>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{passenger.pickup} · {passenger.pickupTime}</Text>
              </View>
              <Pressable onPress={() => call(passenger.phone)} accessibilityRole="button" accessibilityLabel={`Call ${passenger.name}`} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
                <MaterialCommunityIcons name="phone-outline" size={19} color={colors.text} />
              </Pressable>
            </View>
            <ActionRow left={{ title: "No-show", onPress: nextLeg }} right={{ title: "Picked up", green: true, wide: true, onPress: nextLeg }} />
          </>
        ) : (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <MaterialCommunityIcons name="office-building" size={20} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md, flex: 1 }}>Perficient Bellandur</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>Arrive 9:15</Text>
            </View>
            <Pressable onPress={complete} disabled={!arrived} accessibilityRole="button" accessibilityState={{ disabled: !arrived }} style={{ backgroundColor: arrived ? colors.green : colors.disabled, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: "center" }}>
              <Text style={{ color: colors.onGreen, fontWeight: "800", fontSize: fontSize.md }}>{arrived ? "Complete ride" : "Driving to the office…"}</Text>
            </Pressable>
          </>
        )}
      </MapSheet>
    </View>
  );
}
