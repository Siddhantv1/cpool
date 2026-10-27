import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LiveMap from "../components/LiveMap";
import { ActionRow, Avatar, call, EtaCard, MapSheet, Plate, RoundButton, shareTrip, SosButton, Stops } from "../components/RideUI";
import { useTheme } from "../constants/theme";
import { HOSTS, OFFICES, PICKUP_INDEX, ROUTE } from "../lib/mock";
import { lengthKm } from "../lib/route";
import { clearBooking, getTrips } from "../lib/trips";
import { useMovement } from "../lib/useMovement";

const TO_OFFICE = ROUTE.slice(PICKUP_INDEX);
const ALREADY = ROUTE.slice(0, PICKUP_INDEX + 1);
const KM = lengthKm(TO_OFFICE);
const PINS = [
  { id: "start", kind: "start", coords: ROUTE[PICKUP_INDEX] },
  { id: "office", kind: "office", coords: OFFICES[0].coords },
];

// On the way to the office after pickup.
export default function Riding() {
  const { colors, spacing, fontSize, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const h = getTrips().booking?.host ?? HOSTS[0];
  const [arrived, setArrived] = useState(false);
  const move = useMovement(TO_OFFICE, 25000, { onArrive: () => setArrived(true) });
  const kmLeft = KM * (1 - move.t);
  const mins = Math.max(1, Math.round(kmLeft / 0.4));

  function done() {
    clearBooking();
    router.replace("/home");
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <LiveMap route={ROUTE} done={[...ALREADY, ...move.done]} pins={PINS} vehicle={{ point: move.point, heading: move.heading, type: h.type }} />
      </View>
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.md }}>
        <EtaCard big={arrived ? "0" : mins} title={arrived ? "You've arrived" : "To Perficient Bellandur"} subtitle={arrived ? "Have a good day at work" : `Arrive 9:15 AM · ${kmLeft.toFixed(1)} km left`} live={!arrived} />
      </View>
      <View style={{ position: "absolute", right: spacing.md, top: insets.top + 110, gap: spacing.sm }}>
        <SosButton />
        <RoundButton icon="share-outline" label="Share trip" onPress={() => shareTrip(`I'm riding with ${h.name} (${h.plate}) to Perficient Bellandur, arriving about 9:15 AM.`)} />
      </View>

      <View style={{ flex: 1 }} />
      <MapSheet>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Avatar initials={h.initials} color={h.color} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md }} numberOfLines={1}>With {h.name.split(" ")[0]}</Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }} numberOfLines={1}>{h.vehicle}</Text>
          </View>
          <Plate text={h.plate} />
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surface, overflow: "hidden" }} accessible accessibilityLabel={`Trip ${Math.round(move.t * 100)}% done`}>
          <View style={{ width: `${Math.max(6, move.t * 100)}%`, height: "100%", backgroundColor: colors.green, borderRadius: 3 }} />
        </View>
        <Stops
          stops={[
            { title: "Picked up · HSR Layout", time: h.time, done: true },
            { title: "Drop · Perficient Bellandur", time: "9:15", done: arrived },
          ]}
        />
        {arrived ? (
          <Pressable onPress={done} accessibilityRole="button" style={{ backgroundColor: colors.green, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}>
            <Ionicons name="checkmark-circle" size={18} color={colors.onGreen} />
            <Text style={{ color: colors.onGreen, fontWeight: "800", fontSize: fontSize.md }}>Done</Text>
          </Pressable>
        ) : (
          <ActionRow left={{ title: "Share trip", icon: "share-outline", onPress: () => shareTrip(`Riding with ${h.name} (${h.plate}).`) }} right={{ title: "Call", icon: "call-outline", onPress: () => call(h.phone) }} />
        )}
      </MapSheet>
    </View>
  );
}
