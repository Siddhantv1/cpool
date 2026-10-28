import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LiveMap from "../components/LiveMap";
import { ActionRow, Avatar, call, MapSheet, RoundButton, SosButton } from "../components/RideUI";
import { useTheme } from "../constants/theme";
import { arriveAt, useRoute, walkLabel } from "../lib/directions";
import { HOME, OFFICES } from "../lib/mock";
import { finishHosting, useTrips } from "../lib/trips";
import { useMovement } from "../lib/useMovement";

function openGoogleMaps([lng, lat]) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  Linking.openURL(url).catch(() => Alert.alert("Can’t open Google Maps"));
}

const distanceText = (km) => (km < 0.05 ? "Now" : km < 1 ? `${Math.round((km * 1000) / 10) * 10} m` : `${km.toFixed(1)} km`);

// The turn coming up: while driving step i, the next maneuver is step i + 1's instruction.
function nextTurn(steps, travelledKm) {
  const i = Math.max(0, steps.findIndex((s) => travelledKm < s.endKm));
  const current = steps[i] ?? steps[steps.length - 1];
  const next = steps[i + 1] ?? current;
  return { text: next.text, icon: next.icon, inKm: Math.max(0, current.endKm - travelledKm) };
}

// You're the host: drive to the pickup, then to the office, with real turn-by-turn steps.
export default function Drive() {
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  const insets = useSafeAreaInsets();
  const { passenger, published } = useTrips();
  const [leg, setLeg] = useState(0); // 0 = to the pickup, 1 = to the office
  const [arrived, setArrived] = useState(false);
  const from = published?.from ?? HOME;
  const to = published?.to ?? OFFICES[0];
  const route = useRoute(passenger ? [from.coords, passenger.coords, to.coords] : null);
  const current = route?.legs[leg];
  // shortcut: your position is simulated along the real route; use the phone's GPS (expo-location watchPosition) for real driving.
  const move = useMovement(current?.coords ?? null, leg === 0 ? 20000 : 22000, { onArrive: () => setArrived(true) });
  // The guest walking to their pickup, shown while you drive there.
  // shortcut: simulated along a real walking route; the backend will send the guest's live GPS (GET /v1/rides/{id}/live).
  const guestWalk = useRoute(passenger && leg === 0 ? [passenger.from, passenger.coords] : null, "walking");
  const guest = useMovement(guestWalk?.coords ?? null, 15000);
  const guestLeftM = guestWalk ? Math.round(guestWalk.km * 1000 * (1 - guest.t)) : null;
  const guestWaiting = guestLeftM != null && guestLeftM <= 50;
  if (!passenger) return <Redirect href="/home" />;

  const travelled = current ? current.km * move.t : 0;
  const turn = current ? nextTurn(current.steps, travelled) : null;
  const minsLeft = current ? Math.max(1, Math.round(current.minutes * (1 - move.t))) : null;
  const target = leg === 0 ? passenger.coords : to.coords;
  const done = current ? (leg === 1 ? [...route.legs[0].coords, ...move.done] : move.done) : null;
  const pins =
    leg === 0
      ? [
          { id: "pickup", kind: "pickup", coords: passenger.coords },
          { id: "office", kind: "office", coords: to.coords },
          ...(guestWalk && guest.point ? [{ id: "guest", kind: "guest", coords: guest.point }] : []),
        ]
      : [{ id: "office", kind: "office", coords: to.coords }];

  function nextLeg() {
    setArrived(false);
    setLeg(1);
  }
  function complete() {
    finishHosting();
    router.replace("/home");
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <LiveMap route={route?.coords} walks={leg === 0 && guestWalk ? [guestWalk.coords] : []} done={done} pins={pins} vehicle={current ? { point: move.point, heading: move.heading, self: true } : null} />
      </View>

      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.md }} accessibilityLiveRegion="polite">
        <View style={{ backgroundColor: colors.green, borderTopLeftRadius: radius.lg + 2, borderTopRightRadius: radius.lg + 2, borderBottomLeftRadius: rs(4), borderBottomRightRadius: rs(4), padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View style={{ width: rs(48), height: rs(48), borderRadius: rs(12), backgroundColor: colors.onImageInk + "2E", alignItems: "center", justifyContent: "center" }}>
            <MaterialCommunityIcons name={turn?.icon ?? "navigation-variant"} size={rs(28)} color={colors.onGreen} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.onGreen, fontSize: rf(24), fontWeight: "800" }}>{turn ? distanceText(turn.inKm) : "…"}</Text>
            <Text style={{ color: colors.onGreen, fontWeight: "700" }} numberOfLines={2}>{turn ? turn.text : "Finding the route…"}</Text>
          </View>
        </View>
        <View style={{ backgroundColor: colors.green, opacity: 0.85, borderBottomLeftRadius: radius.md + 2, borderBottomRightRadius: radius.md + 2, marginTop: 2, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: colors.onGreen, fontSize: rf(12), fontWeight: "600" }}>{leg === 0 ? `Then pick up ${passenger.name.split(" ")[0]}` : `Then drop at ${to.name}`}</Text>
          <Text style={{ color: colors.onGreen, fontSize: rf(12), fontWeight: "600" }}>{minsLeft ? `${minsLeft} min · ${(current.km - travelled).toFixed(1)} km` : ""}</Text>
        </View>
      </View>

      <View style={{ position: "absolute", right: spacing.md, top: insets.top + 150, gap: spacing.sm, alignItems: "center" }}>
        <SosButton />
        <RoundButton label="Navigate with Google Maps" onPress={() => openGoogleMaps(target)} background={colors.primary} icon={<MaterialCommunityIcons name="navigation-variant" size={rs(22)} color={colors.onPrimary} />} />
        <Text style={{ color: colors.text, backgroundColor: colors.background, fontSize: rf(10), fontWeight: "700", paddingHorizontal: rs(5), borderRadius: rs(6), overflow: "hidden" }}>Google Maps</Text>
      </View>

      <View style={{ flex: 1 }} />
      <MapSheet>
        {leg === 0 ? (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md }}>Next pickup</Text>
              <Text style={{ color: colors.textMuted, fontSize: rf(12), fontWeight: "600" }}>1 of 1</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Avatar initials={passenger.initials} color="#7C3AED" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md }}>{passenger.name}</Text>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{passenger.pickup} · {passenger.pickupTime}</Text>
              </View>
              <Pressable onPress={() => call(passenger.phone)} accessibilityRole="button" accessibilityLabel={`Call ${passenger.name}`} style={{ width: rs(42), height: rs(42), borderRadius: rs(21), backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
                <MaterialCommunityIcons name="phone-outline" size={rs(19)} color={colors.text} />
              </Pressable>
            </View>
            {guestWalk ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: guestWaiting ? colors.greenSurface : colors.surface, borderRadius: radius.lg, padding: spacing.sm + 4 }} accessibilityLiveRegion="polite">
                <MaterialCommunityIcons name={guestWaiting ? "check-circle" : "walk"} size={rs(18)} color={guestWaiting ? colors.green : "#7C3AED"} />
                <Text style={{ flex: 1, color: guestWaiting ? colors.green : colors.text, fontWeight: "700", fontSize: fontSize.sm }}>
                  {guestWaiting ? `${passenger.name.split(" ")[0]} is waiting at the pickup` : `${passenger.name.split(" ")[0]} is walking to the pickup · ${walkLabel(guestLeftM / 1000)} left`}
                </Text>
              </View>
            ) : null}
            <ActionRow left={{ title: "No-show", onPress: nextLeg }} right={{ title: "Picked up", green: true, wide: true, onPress: nextLeg }} />
          </>
        ) : (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <MaterialCommunityIcons name="office-building" size={rs(20)} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md, flex: 1 }} numberOfLines={1}>{to.name}</Text>
              <Text style={{ color: colors.textMuted, fontSize: rf(12) }}>{current ? `Arrive ${arriveAt(current.minutes * (1 - move.t))}` : ""}</Text>
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
