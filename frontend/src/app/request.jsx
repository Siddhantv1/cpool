import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LiveMap from "../components/LiveMap";
import { ActionRow, Avatar, call, MapSheet, Stops } from "../components/RideUI";
import { useTheme } from "../constants/theme";
import { goBack } from "../lib/nav";
import { playAlert } from "../lib/alerts";
import { useRoute } from "../lib/directions";
import { HOME, OFFICES } from "../lib/mock";
import { answerRequest, useTrips } from "../lib/trips";

// A colleague asked for a seat in your ride: who, where, when, then Accept or Decline.
export default function Request() {
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const { requests, published, passengers } = useTrips();
  const [index, setIndex] = useState(Math.max(0, requests.findIndex((r) => r.id === id)));
  const [leaving, setLeaving] = useState(false);
  // Keep the index valid when a request is answered and the list gets shorter.
  const idx = Math.min(index, requests.length - 1);
  const req = requests[idx];
  const seats = published?.seats ?? 1;
  const left = seats - passengers.length;
  const from = published?.from ?? HOME;
  const to = published?.to ?? OFFICES[0];
  // Your route with this colleague's pickup on the way, and without it, to work out the real detour.
  const withGuest = useRoute(req ? [from.coords, req.coords, to.coords] : null);
  const direct = useRoute([from.coords, to.coords]);
  // Their walk from where they are to the pickup (dotted on the map).
  const walk = useRoute(req?.from ? [req.from, req.coords] : null, "walking");
  // Answering the last request empties the list while we go back; render nothing then instead of redirecting too.
  if (!req) return leaving ? null : <Redirect href="/home" />;

  const together = withGuest ? `${withGuest.legs[1].km.toFixed(1)} km` : req.together;
  const extra = withGuest && direct ? Math.max(0, Math.round(withGuest.minutes - direct.minutes)) : null;
  const detour = extra === null ? req.detour : extra === 0 ? "No detour" : `+${extra} min`;
  // Every guest who asked is on the map; the one shown in the card pops (bigger badge with a pointer). Tap a badge to switch.
  const pins = [
    { id: "start", kind: "start", coords: from.coords },
    { id: "office", kind: "office", coords: to.coords },
    ...requests.map((r, i) => ({
      id: r.id,
      kind: "person",
      label: r.initials,
      focused: i === idx,
      coords: r.coords,
      onPress: () => setIndex(i),
      a11y: `Show ${r.name}’s request`,
    })),
  ];
  // Frame you, the office and every guest once, so switching guests doesn't move the map.
  const fit = [from.coords, to.coords, ...requests.flatMap((r) => (r.from ? [r.coords, r.from] : [r.coords]))];

  // After answering, show the next request if there's one you can still act on; otherwise go back.
  function answer(accept) {
    if (!answerRequest(req.id, accept)) return Alert.alert("Your ride is full", "Every seat is taken. Decline this request or cancel a guest first.");
    if (accept) playAlert("accepted");
    const others = requests.length - 1;
    if (others > 0 && (!accept || left - 1 > 0)) return setIndex(Math.min(idx, others - 1));
    setLeaving(true);
    goBack();
  }
  const decline = () =>
    Alert.alert(`Decline ${req.name.split(" ")[0]}’s request?`, "They’ll be told you can’t take them and can request another ride.", [
      { text: "Back", style: "cancel" },
      { text: "Decline", style: "destructive", onPress: () => answer(false) },
    ]);

  const chip = (icon, text) => (
    <View key={text} style={{ flexDirection: "row", alignItems: "center", gap: rs(5), backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs + 2 }}>
      <MaterialCommunityIcons name={icon} size={rs(14)} color={colors.text} />
      <Text style={{ color: colors.text, fontWeight: "600", fontSize: rf(12) }}>{text}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1 }}>
        {/* Same map for every guest: only the line, badges and walk update, so it never reloads. */}
        <LiveMap route={withGuest?.coords ?? direct?.coords} walks={walk ? [walk.coords] : []} pins={pins} fit={fit} padding={{ top: rs(90), bottom: rs(60), left: rs(50), right: rs(50) }} />
        <View style={{ position: "absolute", top: insets.top + spacing.sm, left: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Close" style={{ width: rs(38), height: rs(38), borderRadius: rs(19), backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="close" size={rs(20)} color={colors.text} />
          </Pressable>
          <View style={{ backgroundColor: colors.background, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
            <Text style={{ color: colors.text, fontWeight: "800" }}>Seat request</Text>
          </View>
        </View>
      </View>

      <View style={{ marginTop: -rs(20) }}>
        <MapSheet>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <View style={{ width: rs(8), height: rs(8), borderRadius: rs(4), backgroundColor: colors.green }} />
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: rf(12) }}>New request</Text>
            <Text style={{ color: colors.textMuted, fontSize: rf(12) }}>· {req.expiresIn} left</Text>
            <View style={{ flex: 1 }} />
            {requests.length > 1 ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                <Pressable onPress={() => setIndex((idx - 1 + requests.length) % requests.length)} accessibilityRole="button" accessibilityLabel="Previous request" style={{ width: rs(28), height: rs(28), borderRadius: rs(14), backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="chevron-back" size={rs(15)} color={colors.text} />
                </Pressable>
                <Text style={{ color: colors.textMuted, fontWeight: "700", fontSize: rf(12) }}>{idx + 1} of {requests.length}</Text>
                <Pressable onPress={() => setIndex((idx + 1) % requests.length)} accessibilityRole="button" accessibilityLabel="Next request" style={{ width: rs(28), height: rs(28), borderRadius: rs(14), backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="chevron-forward" size={rs(15)} color={colors.text} />
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <Avatar initials={req.initials} color="#7C3AED" size={rs(52)} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: rs(6) }}>
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.lg - 2 }}>{req.name}</Text>
                <Ionicons name="checkmark-circle" size={rs(16)} color={colors.primary} accessibilityLabel="Verified" />
              </View>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{req.rides} rides completed</Text>
            </View>
            <Pressable onPress={() => call(req.phone)} accessibilityRole="button" accessibilityLabel={`Call ${req.name}`} style={{ width: rs(44), height: rs(44), borderRadius: rs(22), backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="call-outline" size={rs(19)} color={colors.text} />
            </Pressable>
          </View>

          <Stops
            stops={[
              { title: req.pickup, subtitle: `Pickup · walks ${req.walk}`, time: req.pickupTime },
              { title: req.drop, subtitle: "Drop", time: req.dropTime },
            ]}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {[chip("car", `${together} together`), chip("clock-outline", extra === 0 ? detour : `${detour} for you`), chip("seat-passenger", left > 0 ? `${left} of ${seats} seats left` : "Ride full")]}
          </View>
          <ActionRow left={{ title: "Decline", onPress: decline }} right={left > 0 ? { title: "Accept", green: true, wide: true, onPress: () => answer(true) } : { title: "Ride full", wide: true, onPress: () => answer(true) }} />
        </MapSheet>
      </View>
    </View>
  );
}
