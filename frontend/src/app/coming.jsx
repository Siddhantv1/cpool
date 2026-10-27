import { Ionicons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LiveMap from "../components/LiveMap";
import { ActionRow, Avatar, call, EtaCard, MapSheet, Plate, RoundButton, shareTrip, SosButton } from "../components/RideUI";
import { useTheme } from "../constants/theme";
import { playAlert } from "../lib/alerts";
import { useMeetRoute, useRoute, walkLabel } from "../lib/directions";
import { km } from "../lib/route";
import { useTrips } from "../lib/trips";
import { useMeetCheck } from "../lib/useMeetCheck";
import { useMovement } from "../lib/useMovement";

const NEARBY_KM = 0.5;

// The host is driving to your pickup point.
export default function Coming() {
  const { colors, spacing, fontSize, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { booking } = useTrips();
  const [phase, setPhase] = useState("coming"); // coming → nearby → arrived
  // The host drives their own route; you walk to the closest point on it (the meet point).
  const plan = useMeetRoute(booking?.host.start, booking?.drop.coords, booking?.pickup.coords);
  const leg = plan?.toMeet;
  const meet = plan?.meet ?? null; // null until the host's route has loaded
  const needsWalk = !!meet && km(booking.pickup.coords, meet) > 0.03;
  const walk = useRoute(needsWalk ? [booking.pickup.coords, meet] : null, "walking");
  // Your phone's GPS: how far you are from the meet point, and whether you've reached it.
  const check = useMeetCheck(needsWalk ? meet : null);
  // shortcut: the host's position is simulated along the real route; use GET /v1/rides/{id}/live when the backend is ready.
  const move = useMovement(leg?.coords ?? null, 20000, {
    nearAt: leg ? Math.max(0, 1 - NEARBY_KM / leg.km) : 0.8,
    onNear: () => {
      setPhase("nearby");
      playAlert("nearby");
    },
    onArrive: () => setPhase("arrived"),
  });
  if (!booking) return <Redirect href="/home" />;
  const h = booking.host;
  const first = h.name.split(" ")[0];
  const kmLeft = leg ? leg.km * (1 - move.t) : 0;
  const mins = leg ? Math.max(1, Math.round(leg.minutes * (1 - move.t))) : "–";
  const pins = [
    ...(needsWalk ? [{ id: "me", kind: "start", coords: check.here ?? booking.pickup.coords }] : []),
    { id: "pickup", kind: "pickup", coords: meet ?? booking.pickup.coords },
    { id: "office", kind: "office", coords: booking.drop.coords },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <LiveMap route={plan?.route.coords} walks={walk ? [walk.coords] : []} done={leg ? move.done : null} pins={pins} vehicle={leg ? { point: move.point, heading: move.heading, type: h.type } : null} />
      </View>

      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.md }}>
        {phase === "arrived" ? (
          <EtaCard big="0" title={`${first} has arrived`} subtitle="Look for the number plate below" />
        ) : (
          <EtaCard big={mins} title={phase === "nearby" ? `${first} is nearby` : `${first} is on the way`} subtitle={leg ? `To your pickup · ${kmLeft.toFixed(1)} km away` : "Finding the route…"} />
        )}
      </View>
      <View style={{ position: "absolute", right: spacing.md, top: insets.top + 110, gap: spacing.sm }}>
        <SosButton />
        <RoundButton icon="share-outline" label="Share trip" onPress={() => shareTrip(`I'm riding with ${h.name} (${h.plate}) to ${booking.drop.name}.`)} />
      </View>

      <View style={{ flex: 1 }} />
      <MapSheet>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md }}>
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: "#7C3AED" }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600" }}>Meet point</Text>
            <Text style={{ color: check.arrived ? colors.green : colors.text, fontWeight: "700", fontSize: fontSize.md }} numberOfLines={2} accessibilityLiveRegion="polite">
              {!needsWalk
                ? "On your street"
                : check.arrived
                  ? `You’re at the meet point ✓ ${first} can see you’re waiting`
                  : check.metersLeft != null
                    ? `${walkLabel(check.metersLeft / 1000)} to go`
                    : walk
                      ? `${walkLabel(walk.km)} walk from ${booking.pickup.here ? "you" : booking.pickup.name}`
                      : "Working out the walk…"}
            </Text>
            {needsWalk && !check.allowed ? <Text style={{ color: colors.textMuted, fontSize: 12 }}>Turn on location so {first} knows when you reach it.</Text> : null}
          </View>
          {walk && !check.arrived ? (
            <Pressable onPress={() => meet && Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${meet[1]},${meet[0]}&travelmode=walking`)} accessibilityRole="button" accessibilityLabel="Walking directions in Google Maps" style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.ink, borderRadius: radius.pill, paddingHorizontal: spacing.sm + 4, paddingVertical: spacing.sm }}>
              <Ionicons name="walk" size={14} color={colors.onInk} />
              <Text style={{ color: colors.onInk, fontWeight: "800", fontSize: 12 }}>Walk</Text>
            </Pressable>
          ) : null}
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
