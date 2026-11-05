import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LiveMap from "../components/LiveMap";
import { ActionRow, Avatar, call, EtaCard, MapSheet, Plate, RoundButton, shareTrip, SosButton } from "../components/RideUI";
import { fonts, useTheme } from "../constants/theme";
import { playAlert } from "../lib/alerts";
import { arriveAt, useMeetRoute, useRoute, walkLabel } from "../lib/directions";
import { km, liveBar, trafficSegments } from "../lib/route";
import { endLiveRide, onIslandAction, showLiveRide, startRide, vehicleColour } from "../lib/live";
import { alertIn, cancelScheduled } from "../lib/notify";
import { useTrips } from "../lib/trips";
import { useMeetCheck } from "../lib/useMeetCheck";
import { useMovement } from "../lib/useMovement";

const NEARBY_KM = 0.5;
const DRIVE_MS = 20000; // shortcut: simulated drive to your pickup

// The host is driving to your pickup point.
export default function Coming() {
  const { colors, spacing, radius, rs, rf } = useTheme();
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
  const move = useMovement(leg?.coords ?? null, DRIVE_MS, {
    nearAt: leg ? Math.max(0, 1 - NEARBY_KM / leg.km) : 0.8,
    onNear: () => {
      setPhase("nearby");
      playAlert("nearby");
    },
    onArrive: () => setPhase("arrived"),
  });
  // The live ride card in the notification shade: updated every 5% of the drive, removed when you leave this screen.
  const host = booking?.host;
  const [leftAt] = useState(() => arriveAt(0).split(" ")[0]); // when the host set off: "Left 8:24" on the card
  const step = leg ? Math.floor(move.t * 20) * 5 : null;
  const minsAway = leg ? Math.max(1, Math.round(leg.minutes * (1 - move.t))) : null;
  useEffect(() => {
    if (!host || step == null) return;
    const name = host.name.split(" ")[0];
    const here = phase === "arrived";
    const progress = here ? 100 : step;
    // The approved demo's card, drawn by Cpool (header, vehicle tile, bar with Left / Pickup labels, Call, Share trip).
    showLiveRide({
      style: "card",
      title: here ? `${name} has arrived` : `${name} is ${minsAway} min away`,
      text: `${host.vehicle} · ${host.plate}${host.type === "bike" && host.helmet ? " · spare helmet for you" : ""}`,
      sub: "Pickup",
      chip: here ? "Here" : `${minsAway} min`, // status-bar chip on phones with their own island
      progress,
      segments: liveBar(progress, 0, 100, trafficSegments(leg.coords, leg.congestion)), // amber / red where it's slow
      points: [{ at: 0, color: "#5E6577" }, { at: 100, color: "#1D4ED8" }],
      labels: [{ at: 0, text: `Left ${leftAt}` }, { at: 100, text: `Pickup ${host.time}` }],
      vehicle: host.type,
      color: vehicleColour(host.vehicle),
      phone: host.phone,
      // Host here: "I'm in the car" takes Share trip's place (same as the button on this screen); Share trip comes back on the riding card.
      share: here ? undefined : `I'm riding with ${host.name} (${host.plate}). Track me on Cpool.`,
      button: here ? { label: "I’m in the car", action: "incar" } : undefined,
    });
    startRide(); // keeps Cpool running so the card updates in the background (safe to call again)
  }, [host, leg, step, minsAway, phase, leftAt]);
  useEffect(() => endLiveRide, []);
  useEffect(() => onIslandAction(({ action }) => action === "incar" && router.replace("/riding")), []);
  // "Has arrived" alert for when you're in another app. Scheduled with Android when the drive starts, because the phone
  // may pause Cpool in the background; cancelled if you leave this screen first.
  const driving = !!leg;
  useEffect(() => {
    if (!driving || !host) return;
    alertIn("arrived", "ride", DRIVE_MS / 1000, { title: `${host.name.split(" ")[0]} has arrived`, body: `Look for ${host.plate} · ${host.vehicle}`, categoryIdentifier: "arrived", data: { url: "/coming", phone: host.phone } });
    return () => {
      cancelScheduled("arrived");
    };
  }, [driving, host]);
  if (!booking) return <Redirect href="/home" />;
  const h = booking.host;
  const first = h.name.split(" ")[0];
  const kmLeft = leg ? leg.km * (1 - move.t) : 0;
  const mins = leg ? Math.max(1, Math.round(leg.minutes * (1 - move.t))) : "–";
  const here = phase === "arrived";
  // The live ride card's bar, same as the island: driven part, traffic ahead (green / amber / red).
  const bar = leg ? liveBar(here ? 100 : move.t * 100, 0, 100, trafficSegments(leg.coords, leg.congestion)) : [];
  const txt = (style) => [{ color: colors.text, fontFamily: fonts.regular }, style];
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

      {/* ETA card (approved design): minutes, who and how far, LIVE, and the live card's progress bar. */}
      <View style={{ marginTop: insets.top + rs(8), marginHorizontal: rs(12) }}>
        <EtaCard
          big={here ? "0" : mins}
          title={here ? `${first} has arrived` : phase === "nearby" ? `${first} is nearby` : `${first} is on the way`}
          subtitle={here ? "Look for the number plate below" : leg ? `To your pickup · ${kmLeft.toFixed(1)} km away` : "Finding the route…"}
          live={!here}
          bar={bar}
          left={`Left ${leftAt}`}
          right={`Pickup ${h.time}`}
        />
      </View>
      <View style={{ position: "absolute", right: rs(12), top: insets.top + rs(150), gap: spacing.sm }}>
        <SosButton />
        <RoundButton icon="share-outline" label="Share trip" onPress={() => shareTrip(`I'm riding with ${h.name} (${h.plate}) to ${booking.drop.name}.`)} />
      </View>

      <View style={{ flex: 1 }} />
      <MapSheet>
        <View style={{ flexDirection: "row", alignItems: "center", gap: rs(12), backgroundColor: colors.purpleSurface, borderRadius: rs(18), padding: rs(12) }}>
          <View style={{ width: rs(36), height: rs(36), borderRadius: rs(12), backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="walk" size={rs(19)} color={colors.purple} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={txt({ color: colors.purple, fontFamily: fonts.bold, fontSize: rf(12) })}>Meet point</Text>
            <Text style={txt({ color: check.arrived ? colors.green : colors.text, fontFamily: fonts.extrabold, fontSize: rf(15) })} numberOfLines={2} accessibilityLiveRegion="polite">
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
            {needsWalk && !check.allowed ? <Text style={txt({ color: colors.textMuted, fontSize: rf(12) })}>Turn on location so {first} knows when you reach it.</Text> : null}
          </View>
          {walk && !check.arrived ? (
            <Pressable onPress={() => meet && Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${meet[1]},${meet[0]}&travelmode=walking`)} accessibilityRole="button" accessibilityLabel="Walking directions in Google Maps" style={{ flexDirection: "row", alignItems: "center", gap: rs(5), backgroundColor: colors.ink, borderRadius: radius.pill, paddingHorizontal: rs(14), height: rs(36) }}>
              <Ionicons name="walk" size={rs(15)} color={colors.onInk} />
              <Text style={txt({ color: colors.onInk, fontFamily: fonts.bold, fontSize: rf(13) })}>Walk</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Avatar initials={h.initials} gender={h.gender} color={h.color} size={rs(46)} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: rs(5) }}>
              <Text style={txt({ fontFamily: fonts.extrabold, fontSize: rf(16) })}>{h.name}</Text>
              <MaterialCommunityIcons name="check-decagram" size={rs(15)} color={colors.green} accessibilityLabel="Verified" />
            </View>
            <Text style={txt({ color: colors.textMuted, fontSize: rf(13) })}>{h.vehicle}</Text>
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
            <Ionicons name="walk" size={rs(16)} color={colors.green} />
            <Text style={txt({ color: colors.green, fontFamily: fonts.bold })}>Start walking to the pickup point</Text>
          </View>
        ) : null}
      </MapSheet>
    </View>
  );
}
