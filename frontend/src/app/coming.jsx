import { Ionicons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LiveMap from "../components/LiveMap";
import { ActionRow, Avatar, call, EtaCard, MapSheet, Plate, RoundButton, shareTrip, SosButton } from "../components/RideUI";
import { useTheme } from "../constants/theme";
import { playAlert } from "../lib/alerts";
import { OFFICES, PICKUP_INDEX, ROUTE } from "../lib/mock";
import { lengthKm } from "../lib/route";
import { useTrips } from "../lib/trips";
import { useMovement } from "../lib/useMovement";

const TO_PICKUP = ROUTE.slice(0, PICKUP_INDEX + 1);
const KM = lengthKm(TO_PICKUP);
const PINS = [
  { id: "pickup", kind: "pickup", coords: ROUTE[PICKUP_INDEX] },
  { id: "office", kind: "office", coords: OFFICES[0].coords },
];

// The host is driving to your pickup point.
export default function Coming() {
  const { colors, spacing, fontSize, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { booking } = useTrips();
  const [phase, setPhase] = useState("coming"); // coming → nearby → arrived
  const move = useMovement(TO_PICKUP, 20000, {
    onNear: () => {
      setPhase("nearby");
      playAlert("nearby");
    },
    onArrive: () => setPhase("arrived"),
  });
  if (!booking) return <Redirect href="/home" />;
  const h = booking.host;
  const first = h.name.split(" ")[0];
  const kmLeft = KM * (1 - move.t);
  const mins = Math.max(1, Math.round(kmLeft / 0.4));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <LiveMap route={ROUTE} done={move.done} pins={PINS} vehicle={{ point: move.point, heading: move.heading, type: h.type }} />
      </View>

      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.md }}>
        {phase === "arrived" ? (
          <EtaCard big="0" title={`${first} has arrived`} subtitle="Look for the number plate below" />
        ) : (
          <EtaCard big={mins} title={phase === "nearby" ? `${first} is nearby` : `${first} is on the way`} subtitle={`To your pickup · ${kmLeft.toFixed(1)} km away`} />
        )}
      </View>
      <View style={{ position: "absolute", right: spacing.md, top: insets.top + 110, gap: spacing.sm }}>
        <SosButton />
        <RoundButton icon="share-outline" label="Share trip" onPress={() => shareTrip(`I'm riding with ${h.name} (${h.plate}) to Perficient Bellandur.`)} />
      </View>

      <View style={{ flex: 1 }} />
      <MapSheet>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md }}>
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: "#7C3AED" }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600" }}>Meet at</Text>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: fontSize.md }}>HSR Layout · 27th Main</Text>
          </View>
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>2 min walk</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Avatar initials={h.initials} color={h.color} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md }}>{h.name}</Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{h.vehicle}</Text>
          </View>
          <Plate text={h.plate} />
        </View>
        {phase === "arrived" ? (
          <ActionRow left={{ title: "Call", icon: "call-outline", onPress: () => call(h.phone) }} right={{ title: "I'm in the car", green: true, wide: true, onPress: () => router.replace("/riding") }} />
        ) : (
          <ActionRow left={{ title: "Share trip", icon: "share-outline", onPress: () => shareTrip(`${h.name} is picking me up (${h.plate}).`) }} right={{ title: `Call ${first}`, icon: "call-outline", onPress: () => call(h.phone) }} />
        )}
        {phase === "nearby" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }} accessibilityLiveRegion="polite">
            <Ionicons name="walk" size={16} color={colors.green} />
            <Text style={{ color: colors.green, fontWeight: "700" }}>Start walking to the pickup point</Text>
          </View>
        ) : null}
      </MapSheet>
    </View>
  );
}
