import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LiveMap from "../components/LiveMap";
import { ActionRow, Avatar, call, EtaCard, MapSheet, Plate, RoundButton, shareTrip, SosButton, Stops } from "../components/RideUI";
import { useTheme } from "../constants/theme";
import { arriveAt, useMeetRoute } from "../lib/directions";
import { endLiveRide, showLiveRide, startRide, vehicleColour } from "../lib/live";
import { HOSTS, MEET_POINT, OFFICES } from "../lib/mock";
import { clearBooking, getTrips } from "../lib/trips";
import { liveBar, trafficSegments } from "../lib/route";
import { useMovement } from "../lib/useMovement";

const CARD_AFTER_ARRIVAL_MS = 2 * 60000; // the live card stays this long after you arrive, then goes away
const short = (time) => time.replace(/ (AM|PM)$/, "");

// On the way to the office after pickup.
export default function Riding() {
  const { colors, spacing, fontSize, radius, rs } = useTheme();
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
  // The live ride card (same approved guest card as on the way to the pickup), now to the office: updated every 5% of
  // the drive, removed a while after you arrive or when you leave this screen.
  const [over, setOver] = useState(false);
  useEffect(() => {
    if (!arrived) return;
    const t = setTimeout(() => setOver(true), CARD_AFTER_ARRIVAL_MS);
    return () => clearTimeout(t);
  }, [arrived]);
  const step = leg ? Math.floor(move.t * 20) * 5 : null;
  useEffect(() => {
    if (over) return endLiveRide();
    if (step == null) return;
    const progress = arrived ? 100 : step;
    showLiveRide({
      style: "card",
      title: arrived ? `You’ve arrived at ${drop.name}` : `${drop.name} in ${mins} min`,
      text: `With ${h.name.split(" ")[0]} · ${h.vehicle} · ${h.plate}`,
      sub: "Riding",
      chip: arrived ? "Here" : `${mins} min`,
      progress,
      segments: liveBar(progress, 0, 100, trafficSegments(leg.coords, leg.congestion)),
      points: [{ at: 0, color: "#5E6577" }, { at: 100, color: "#1D4ED8" }],
      labels: [{ at: 0, text: `Picked up ${short(h.time)}` }, { at: 100, text: arrived ? "Arrived" : `Arrive ${short(eta)}` }],
      vehicle: h.type,
      color: vehicleColour(h.vehicle),
      phone: h.phone,
      share: `I'm riding with ${h.name} (${h.plate}) to ${drop.name}. Track me on Cpool.`,
      url: "cpool:///riding",
    });
    // Keeps Cpool running so the card updates in the background. Safe to call again; also restarts it if the
    // Coming screen's clean-up ended the ride after this screen had opened.
    startRide();
  }, [over, step, arrived, mins, eta, leg, h, drop]);
  useEffect(() => endLiveRide, []);
  const pins = [
    { id: "start", kind: "start", coords: plan?.meet ?? pickup.coords },
    { id: "office", kind: "office", coords: drop.coords },
  ];

  // Close every ride screen first, then clear the booking, so screens still in the back-stack don't redirect at the same time.
  function done() {
    if (router.canDismiss()) router.dismissAll();
    else router.replace("/home");
    clearBooking();
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
          <Avatar initials={h.initials} gender={h.gender} color={h.color} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md }} numberOfLines={1}>With {h.name.split(" ")[0]}</Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }} numberOfLines={1}>{h.vehicle}</Text>
          </View>
          <Plate text={h.plate} />
        </View>
        <View style={{ height: rs(6), borderRadius: rs(3), backgroundColor: colors.surface, overflow: "hidden" }} accessible accessibilityLabel={`Trip ${Math.round(move.t * 100)}% done`}>
          <View style={{ width: `${Math.max(6, move.t * 100)}%`, height: "100%", backgroundColor: colors.green, borderRadius: rs(3) }} />
        </View>
        <Stops
          stops={[
            { title: "Picked up at the meet point", time: h.time, done: true },
            { title: `Drop · ${drop.name}`, time: short(eta), done: arrived },
          ]}
        />
        {arrived ? (
          <Pressable onPress={done} accessibilityRole="button" style={{ backgroundColor: colors.green, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: rs(6) }}>
            <Ionicons name="checkmark-circle" size={rs(18)} color={colors.onGreen} />
            <Text style={{ color: colors.onGreen, fontWeight: "800", fontSize: fontSize.md }}>Done</Text>
          </Pressable>
        ) : (
          <ActionRow left={{ title: "Share trip", icon: "share-outline", onPress: () => shareTrip(`Riding with ${h.name} (${h.plate}).`) }} right={{ title: "Call", icon: "call-outline", onPress: () => call(h.phone) }} />
        )}
      </MapSheet>
    </View>
  );
}
