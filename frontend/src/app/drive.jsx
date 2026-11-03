import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LiveMap from "../components/LiveMap";
import { ActionRow, Avatar, call, MapSheet, RoundButton, SosButton } from "../components/RideUI";
import { useTheme } from "../constants/theme";
import { arriveAt, useRoute, walkLabel } from "../lib/directions";
import { endLiveRide, maybeAskForIsland, onIslandAction, showLiveRide, startRide, vehicleColour } from "../lib/live";
import { HOME, OFFICES } from "../lib/mock";
import { alertIn, alertNow, cancelScheduled } from "../lib/notify";
import { liveBar, trafficSegments } from "../lib/route";
import { getSession } from "../lib/session";
import { confirmPickup, finishHosting, nextPickup, useTrips } from "../lib/trips";
import { useMovement } from "../lib/useMovement";

// shortcut: simulated drive and walk times for the example ride.
const PICKUP_MS = 20000;
const OFFICE_MS = 22000;
const WALK_MS = 15000;
const AUTO_COMPLETE_MS = 2 * 60000; // at the destination the ride completes by itself if the host doesn't tap Complete ride
// Live card colours (from the approved demo): start, guests, destination.
const START = "#5E6577";
const GUEST = "#6D28D9";
const END = "#1D4ED8";
const firstName = (p) => p.name.split(" ")[0];
const stopLabel = (p) => (p.id === "home" ? "Home" : OFFICES.some((o) => o.id === p.id) ? "Office" : p.name);

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

// You're the host: pick up each guest in turn, then drive to the office, with real turn-by-turn steps.
export default function Drive() {
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  const insets = useSafeAreaInsets();
  const { passengers, published, leg } = useTrips(); // leg: 0…n-1 = to guest number leg, n = to the office
  const n = passengers.length;
  const [arrivedOn, setArrivedOn] = useState(null); // the route (leg) whose stop you've reached
  // Ride service + background task (also started by the Start ride buttons); first, before the map loads.
  useEffect(() => startRide(), []);
  const [leaving, setLeaving] = useState(false); // ride completed: going Home
  const from = published?.from ?? HOME;
  const to = published?.to ?? OFFICES[0];
  const complete = useCallback(() => {
    setLeaving(true);
    router.replace("/home");
    finishHosting();
    // Completed from the island or automatically while Cpool is in the background (alertNow is silent when it's open).
    alertNow("ride", { title: "Ride complete", body: `Dropped ${passengers.map(firstName).join(", ")} at ${to.name}` });
  }, [passengers, to]);
  // shortcut: guests are picked up in the order you accepted them; the backend should order pickups along the route.
  const route = useRoute(n ? [from.coords, ...passengers.map((p) => p.coords), to.coords] : null);
  const current = route?.legs[leg];
  const passenger = leg < n ? passengers[leg] : null; // the guest you're driving to now
  // shortcut: your position is simulated along the real route; use the phone's GPS (expo-location watchPosition) for real driving.
  const move = useMovement(current?.coords ?? null, passenger ? PICKUP_MS : OFFICE_MS, { onArrive: setArrivedOn });
  const arrived = !!current && arrivedOn === current.coords;
  // The guest walking to their pickup, shown while you drive there.
  // shortcut: simulated along a real walking route; the backend will send the guest's live GPS (GET /v1/rides/{id}/live).
  const guestWalk = useRoute(passenger?.from ? [passenger.from, passenger.coords] : null, "walking");
  const guest = useMovement(guestWalk?.coords ?? null, WALK_MS);
  const guestLeftM = guestWalk ? Math.round(guestWalk.km * 1000 * (1 - guest.t)) : null;
  const guestWaiting = guestLeftM != null && guestLeftM <= 50;
  const travelled = current ? current.km * move.t : 0;
  const minsLeft = current ? Math.max(1, Math.round(current.minutes * (1 - move.t))) : null;

  // The live card in the notification shade: home → each guest → office on one bar, the next guest's picture, Call.
  // Updated every 5% of the whole drive; removed when you leave this screen.
  const doneKm = route ? route.legs.slice(0, leg).reduce((a, l) => a + l.km, 0) + travelled : 0;
  const step = route?.km ? Math.min(100, Math.floor((doneKm / route.km) * 20) * 5) : null;
  useEffect(() => {
    if (step == null || !n) return;
    const next = passengers[leg];
    let at = 0;
    const stops = route.legs.map((l) => ((at += l.km) / route.km) * 100); // where each stop is on the bar
    const legStart = leg ? stops[leg - 1] : 0;
    const progress = arrived && !next ? 100 : Math.max(step, legStart);
    const v = getSession()?.vehicle;
    const islandText = next ? (arrived ? `At ${firstName(next)}’s pickup` : `Pick up ${firstName(next)} · ${minsLeft} min`) : arrived ? `At ${stopLabel(to)}` : `${stopLabel(to)} · ${minsLeft} min`;
    // The approved demo's card, drawn by Cpool (header, guest's face, a labelled dot per stop, Call).
    showLiveRide({
      style: "card",
      when: "now", // the demo's host header: "Cpool · Driving · now"
      title: next ? (arrived ? `You’re at ${firstName(next)}’s pickup` : `Pick up ${firstName(next)} in ${minsLeft} min`) : arrived ? `You’ve reached ${to.name}` : `${to.name} in ${minsLeft} min`,
      text: next ? `${next.pickup} · then ${[...passengers.slice(leg + 1).map(firstName), to.name].join(", then ")}` : `${passengers.map(firstName).join(", ")} on board`,
      sub: "Driving",
      chip: arrived ? "Here" : `${minsLeft} min`, // status-bar chip on phones with their own island
      progress,
      segments: liveBar(progress, legStart, stops[leg], trafficSegments(current.coords, current.congestion)),
      points: [{ at: 0, color: START }, ...passengers.map((p, i) => ({ at: stops[i], color: GUEST })), { at: 100, color: END }],
      labels: [{ at: 0, text: stopLabel(from) }, ...passengers.map((p, i) => ({ at: stops[i], text: firstName(p) })), { at: 100, text: stopLabel(to) }],
      tile: next ? "face" : "vehicle",
      gender: next?.gender,
      vehicle: v?.type === "bike" ? "bike" : "car",
      color: vehicleColour(`${v?.colour ?? ""} ${v?.model ?? ""}`),
      phone: next?.phone,
      callLabel: next ? `Call ${firstName(next)}` : undefined,
      url: "cpool:///drive",
      // The step's button on the island and on Android's Live Update card: Picked up at a pickup, Complete ride at the end.
      button: !arrived ? undefined : next ? { label: "Picked up", action: "pickedup", id: next.id } : { label: "Complete ride", action: "complete" },
      // The floating island over other apps (approved demo): "Pick up Karthik · 6 min", the ring fills along this leg,
      // green with Picked up once you're at the guest's pickup.
      island: {
        text: islandText,
        ring: Math.round(((progress - legStart) / Math.max(1, stops[leg] - legStart)) * 100),
        here: arrived,
      },
    });
  }, [step, n, leg, arrived, minsLeft, passengers, route, current, from, to]);
  useEffect(() => endLiveRide, []);
  // Ask once for "Display over other apps", with the next pickup in the preview pill.
  useEffect(() => {
    if (passenger && minsLeft != null) maybeAskForIsland(`${firstName(passenger)} · ${minsLeft} min`);
  }, [passenger, minsLeft]);
  // Buttons on the island / Live Update card: same as the buttons here (Picked up only counts for the guest you're driving to).
  useEffect(() => onIslandAction(({ action, id }) => (action === "complete" ? complete() : action === "pickedup" && confirmPickup(id))), [complete]);
  const atEnd = arrived && !passenger;
  useEffect(() => {
    if (!atEnd) return;
    const t = setTimeout(complete, AUTO_COMPLETE_MS);
    return () => clearTimeout(t);
  }, [atEnd, complete]);

  // Guest updates, for when you're in another app (e.g. navigating in Google Maps). Scheduled with Android so they
  // arrive even if the phone pauses Cpool; "Picked up" on the second one moves on to the next stop.
  // shortcut: the example guest is waiting when their walk ends and says they're in the car 3 s after you arrive; the
  // server will push these when the guest's app reports them.
  const guestId = passenger?.id;
  const legReady = !!current;
  useEffect(() => {
    if (!guestId || !legReady) return;
    const p = passengers.find((x) => x.id === guestId);
    alertIn(`waiting-${guestId}`, "guests", WALK_MS / 1000, { title: `${firstName(p)} is waiting at the pickup`, body: `${p.pickup} · pickup at ${p.pickupTime}` });
    alertIn(`incar-${guestId}`, "guests", PICKUP_MS / 1000 + 3, {
      title: `${firstName(p)} says they’re in the car`,
      body: "Tap Picked up to confirm. No need to open Cpool.",
      categoryIdentifier: "guest-in-car",
      data: { guestId },
    });
    return () => {
      cancelScheduled(`waiting-${guestId}`);
      cancelScheduled(`incar-${guestId}`);
    };
  }, [guestId, legReady, passengers]);

  // After Complete ride the guest list empties; render nothing instead of redirecting too (two navigations = white screen).
  if (!n) return leaving ? null : <Redirect href="/home" />;

  const turn = current ? nextTurn(current.steps, travelled) : null;
  const target = passenger ? passenger.coords : to.coords;
  const done = current ? [...route.legs.slice(0, leg).flatMap((l) => l.coords), ...move.done] : null;
  const pins = [
    ...passengers.slice(leg).map((p) => ({ id: p.id, kind: "pickup", coords: p.coords })),
    { id: "office", kind: "office", coords: to.coords },
    ...(passenger && guestWalk && guest.point ? [{ id: "guest", kind: "guest", coords: guest.point }] : []),
  ];

  const nextLeg = nextPickup;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <LiveMap route={route?.coords} walks={passenger && guestWalk ? [guestWalk.coords] : []} done={done} pins={pins} vehicle={current ? { point: move.point, heading: move.heading, self: true } : null} />
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
          <Text style={{ color: colors.onGreen, fontSize: rf(12), fontWeight: "600" }}>{passenger ? `Then pick up ${passenger.name.split(" ")[0]}` : `Then drop at ${to.name}`}</Text>
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
        {passenger ? (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md }}>Next pickup</Text>
              <Text style={{ color: colors.textMuted, fontSize: rf(12), fontWeight: "600" }}>
                {leg + 1} of {n}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Avatar initials={passenger.initials} gender={passenger.gender} color="#7C3AED" />
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
