import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LiveMap from "../components/LiveMap";
import { ActionRow, Avatar, call, EtaCard, MapSheet, Plate, RoundButton, shareTrip, SosButton, Stops } from "../components/RideUI";
import { useTheme } from "../constants/theme";
import { arriveAt, useMeetRoute } from "../lib/directions";
import { HOSTS, MEET_POINT, OFFICES } from "../lib/mock";
import { clearBooking, getTrips } from "../lib/trips";
import { useMovement } from "../lib/useMovement";

// On the way to the office after pickup.
export default function Riding() {
  const { colors, spacing, fontSize, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const booking = getTrips().booking;
  const h = booking?.host ?? HOSTS[0];
  const pickup = booking?.pickup ?? MEET_POINT;
  const drop = booking?.drop ?? OFFICES[0];
  const [arrived, setArrived] = useState(false);
  // From the meet point on the host's route to the office, with traffic.
  const plan = useMeetRoute(h.start, drop.coords, pickup.coords);
  const leg = plan?.fromMeet;
  // shortcut: simulated movement along the real route; the backend will send the car's live position.
  const move = useMovement(leg?.coords ?? null, 25000, { onArrive: () => setArrived(true) });
  const kmLeft = leg ? leg.km * (1 - move.t) : 0;
  const mins = leg ? Math.max(1, Math.round(leg.minutes * (1 - move.t))) : "–";
  const eta = leg ? arriveAt(leg.minutes * (1 - move.t)) : "";
  const pins = [
    { id: "start", kind: "start", coords: plan?.meet ?? pickup.coords },
    { id: "office", kind: "office", coords: drop.coords },
  ];

  function done() {
    clearBooking();
    router.replace("/home");
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <LiveMap route={leg?.coords} done={leg ? move.done : null} pins={pins} vehicle={leg ? { point: move.point, heading: move.heading, type: h.type } : null} />
      </View>
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.md }}>
        <EtaCard
          big={arrived ? "0" : mins}
          title={arrived ? "You’ve arrived" : `To ${drop.name}`}
          subtitle={arrived ? "Have a good day at work" : leg ? `Arrive ${eta} · ${kmLeft.toFixed(1)} km left` : "Finding the route…"}
          live={!arrived}
        />
      </View>
      <View style={{ position: "absolute", right: spacing.md, top: insets.top + 110, gap: spacing.sm }}>
        <SosButton />
        <RoundButton icon="share-outline" label="Share trip" onPress={() => shareTrip(`I’m riding with ${h.name} (${h.plate}) to ${drop.name}${eta ? `, arriving about ${eta}` : ""}.`)} />
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
            { title: "Picked up at the meet point", time: h.time, done: true },
            { title: `Drop · ${drop.name}`, time: eta.replace(/ (AM|PM)$/, ""), done: arrived },
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
