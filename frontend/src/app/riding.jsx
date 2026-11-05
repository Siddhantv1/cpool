import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LiveMap from "../components/LiveMap";
import { Avatar, EtaCard, MapSheet, Plate, RoundButton, shareTrip, SosButton, Stops } from "../components/RideUI";
import { fonts, useTheme } from "../constants/theme";
import { arriveAt, useMeetRoute } from "../lib/directions";
import { endLiveRide, showLiveRide, startRide, vehicleColour } from "../lib/live";
import { HOSTS, MEET_POINT, OFFICES } from "../lib/mock";
import { clearBooking, getTrips, ridePrice } from "../lib/trips";
import { liveBar, trafficSegments } from "../lib/route";
import { useMovement } from "../lib/useMovement";

const CARD_AFTER_ARRIVAL_MS = 2 * 60000; // the live card stays this long after you arrive, then goes away
const short = (time) => time.replace(/ (AM|PM)$/, "");

// On the way to the office after pickup (approved round 3): the same ETA card as "host on the way", the trip in one box
// and what to pay. No Share trip / Call buttons: you're in the car together, and Share is the round button on the map.
export default function Riding() {
  const { colors, spacing, radius, rs, rf } = useTheme();
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
    startRide("guest");
  }, [over, step, arrived, mins, eta, leg, h, drop]);
  useEffect(() => endLiveRide, []);
  const pins = [
    { id: "start", kind: "start", coords: plan?.meet ?? pickup.coords },
    { id: "office", kind: "office", coords: drop.coords },
  ];
  const first = h.name.split(" ")[0];
  const price = ridePrice(h);
  // The live card's bar, same as the island: driven part, traffic ahead (green / amber / red).
  const bar = leg ? liveBar(arrived ? 100 : move.t * 100, 0, 100, trafficSegments(leg.coords, leg.congestion)) : [];
  const txt = (style) => [{ color: colors.text, fontFamily: fonts.regular }, style];

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
      <View style={{ marginTop: insets.top + rs(8), marginHorizontal: rs(12) }}>
        <EtaCard
          big={arrived ? "0" : mins}
          title={arrived ? "You’ve arrived" : `To ${drop.name}`}
          subtitle={arrived ? "Have a good day at work" : leg ? `Arrive ${eta} · ${kmLeft.toFixed(1)} km left` : "Finding the route…"}
          live={!arrived}
          bar={bar}
          left={`Picked up ${short(h.time)}`}
          right={arrived ? "Arrived" : `Arrive ${short(eta)}`}
        />
      </View>
      <View style={{ position: "absolute", right: rs(12), top: insets.top + rs(150), gap: spacing.sm }}>
        <SosButton />
        <RoundButton icon="share-outline" label="Share trip" onPress={() => shareTrip(`I’m riding with ${h.name} (${h.plate}) to ${drop.name}${eta ? `, arriving about ${eta}` : ""}.`)} />
      </View>

      <View style={{ flex: 1 }} />
      <MapSheet>
        <View style={{ flexDirection: "row", alignItems: "center", gap: rs(12) }}>
          <Avatar initials={h.initials} gender={h.gender} color={h.color} size={rs(46)} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: rs(5) }}>
              <Text numberOfLines={1} style={txt({ flexShrink: 1, fontFamily: fonts.extrabold, fontSize: rf(16) })}>With {first}</Text>
              <MaterialCommunityIcons name="check-decagram" size={rs(15)} color={colors.green} accessibilityLabel="Verified" />
            </View>
            <Text numberOfLines={1} style={txt({ color: colors.textMuted, fontSize: rf(13) })}>{h.vehicle}</Text>
          </View>
          <Plate text={h.plate} />
        </View>
        <View style={{ backgroundColor: colors.surface, borderRadius: rs(18), padding: rs(14) }}>
          <Stops
            stops={[
              { title: "Picked up at the meet point", time: h.time, done: true },
              { title: `Drop · ${drop.name}`, time: short(eta), done: arrived },
            ]}
          />
        </View>
        {/* What to pay at the end: cash or UPI, outside the app. */}
        <View accessible accessibilityLabel={`Pay ${first} ${price} rupees, cash or UPI`} style={{ flexDirection: "row", alignItems: "center", gap: rs(12), backgroundColor: colors.greenSurface, borderRadius: rs(18), padding: rs(12), paddingRight: rs(16) }}>
          <View style={{ width: rs(40), height: rs(40), borderRadius: rs(13), backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
            <MaterialCommunityIcons name="currency-inr" size={rs(20)} color={colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={txt({ color: colors.success, fontFamily: fonts.bold, fontSize: rf(15) })}>Pay {first}</Text>
            <Text style={txt({ color: colors.success, fontSize: rf(12.5) })}>Cash or UPI</Text>
          </View>
          <Text style={txt({ color: colors.success, fontFamily: fonts.extrabold, fontSize: rf(22), letterSpacing: -0.4 })}>₹{price}</Text>
        </View>
        {arrived ? (
          <Pressable onPress={done} accessibilityRole="button" style={{ backgroundColor: colors.green, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: rs(6) }}>
            <Ionicons name="checkmark-circle" size={rs(18)} color={colors.onGreen} />
            <Text style={txt({ color: colors.onGreen, fontFamily: fonts.extrabold, fontSize: rf(16) })}>Done</Text>
          </Pressable>
        ) : null}
      </MapSheet>
    </View>
  );
}
