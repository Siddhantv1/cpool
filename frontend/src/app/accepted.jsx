import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LiveMap from "../components/LiveMap";
import { Avatar, call, Plate, RoundButton } from "../components/RideUI";
import { fonts, useTheme } from "../constants/theme";
import { confirmSheet } from "../lib/confirm";
import { clockPlus, useMeetRoute, useRoute, walkUrl } from "../lib/directions";
import { ampm } from "../lib/requestSeat";
import { km } from "../lib/route";
import { updateSession } from "../lib/session";
import { pickupPlan, ridePrice, schedulePickupReminder, useTrips, withdrawBooking } from "../lib/trips";

const REASONS = ["My plans changed", "I found another ride", "Pickup point is too far", "Host asked me to cancel", "Something else"];
const REMIND_CHOICES = [5, 15, 30, 0]; // minutes before you leave (with a walk) or before pickup (no walk); 0 = off
const withAmPm = (t) => `${t} ${ampm(t)}`;

// "Remind me" (approved round 8): 5, 15 or 30 min before you leave (or before pickup with no walk), or no reminder.
function ReminderSheet({ plan, h, subtitle, onDone, onClose }) {
  const { colors, rs, rf } = useTheme();
  const insets = useSafeAreaInsets();
  const [choice, setChoice] = useState(plan.before);
  const txt = (style) => [{ color: colors.text, fontFamily: fonts.regular }, style];
  const timeFor = (m) => clockPlus(h.time, -(plan.walk ? plan.goBefore + m : m));
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.scrim }} onPress={onClose} accessibilityLabel="Close" />
      <View style={{ backgroundColor: colors.background, borderTopLeftRadius: rs(26), borderTopRightRadius: rs(26), paddingTop: rs(10), paddingHorizontal: rs(18), paddingBottom: insets.bottom + rs(16), gap: rs(10) }}>
        <View style={{ alignSelf: "center", width: rs(38), height: rs(4), borderRadius: rs(2), backgroundColor: colors.line, marginBottom: rs(4) }} />
        <View style={{ gap: rs(3) }}>
          <Text accessibilityRole="header" style={txt({ fontFamily: fonts.extrabold, fontSize: rf(19) })}>Remind me</Text>
          <Text style={txt({ color: colors.textMuted, fontSize: rf(13.5) })}>{subtitle}</Text>
        </View>
        <View style={{ gap: rs(8) }} accessibilityRole="radiogroup">
          {REMIND_CHOICES.map((m) => {
            const on = choice === m;
            return (
              <Pressable
                key={m}
                onPress={() => setChoice(m)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={{ flexDirection: "row", alignItems: "center", gap: rs(12), height: rs(50), paddingHorizontal: rs(14), borderRadius: rs(14), borderWidth: 1.5, borderColor: on ? colors.ink : colors.line, backgroundColor: on ? colors.surface : colors.background }}
              >
                <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={rs(22)} color={on ? colors.ink : colors.border} />
                <Text style={txt({ flex: 1, fontFamily: on ? fonts.bold : fonts.medium, fontSize: rf(14.5) })}>
                  {m ? `${m} min before ${plan.walk ? "I leave" : "pickup"}` : "No reminder"}
                </Text>
                {m ? <Text style={txt({ fontFamily: fonts.bold, fontSize: rf(14.5) })}>{timeFor(m)}</Text> : null}
              </Pressable>
            );
          })}
        </View>
        <Text style={txt({ color: colors.textMuted, fontSize: rf(12.5) })}>Your choice is used for your next rides too.</Text>
        <Pressable onPress={() => onDone(choice)} accessibilityRole="button" style={({ pressed }) => ({ height: rs(52), borderRadius: rs(26), backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1 })}>
          <Text style={txt({ color: colors.onInk, fontFamily: fonts.bold, fontSize: rf(15.5) })}>Done</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// Your seat is confirmed (approved round 8): one map with the host's route, your dotted walk, the pickup and the office;
// then the ride ticket, where the walk is one symbol next to the pickup (tap for walking directions) with when to leave,
// and the price and a reminder set from your walk.
export default function Accepted() {
  const { colors, rs, rf } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { booking } = useTrips();
  const [picking, setPicking] = useState(false);
  const [, refresh] = useState(0);
  // Where you meet the host: the closest point on their route, and your walk there (same as "host on the way").
  const plan = useMeetRoute(booking?.host.start, booking?.drop.coords, booking?.pickup.coords);
  const meet = plan?.meet ?? null;
  const needsWalk = !!meet && km(booking.pickup.coords, meet) > 0.03;
  const walk = useRoute(needsWalk ? [booking.pickup.coords, meet] : null, "walking");
  const ready = !!meet && (!needsWalk || !!walk);
  const walkMin = needsWalk && walk ? walk.minutes : null;
  // The real walk replaces the estimate the reminder was first scheduled with (see schedulePickupReminder).
  useEffect(() => {
    if (ready) schedulePickupReminder(walkMin, meet);
  }, [ready, walkMin, meet]);
  if (!booking) return <Redirect href="/home" />;
  // Cancelling moves on to the Cancelled screen; render nothing meanwhile instead of also redirecting.
  if (booking.status !== "accepted") return null;
  const h = booking.host;
  const first = h.name.split(" ")[0];
  const page = colors.surface;
  const txt = (style) => [{ color: colors.text, fontFamily: fonts.regular }, style];
  const p = pickupPlan(walkMin);
  const go = clockPlus(h.time, -p.goBefore);
  const remindAt = clockPlus(h.time, -p.remindBefore);
  const ride = plan?.fromMeet;
  const walkMins = walk ? Math.max(1, Math.round(walk.minutes)) : 0;

  // One sheet with the reasons (replaces the old Cancel your ride page), then the Cancelled screen.
  const cancel = () =>
    confirmSheet({
      title: "Cancel your ride?",
      text: `${first} is keeping a seat for you tomorrow at ${withAmPm(h.time)}.`,
      reasons: REASONS,
      reasonLabel: `Tell ${first} why`,
      other: "Something else",
      tip: `Only running late? Call ${first} instead. Cancelling often makes it harder to get seats.`,
      keep: "Keep my ride",
      confirm: "Cancel ride",
      onConfirm: (reason) => {
        withdrawBooking(reason);
        if (router.canDismiss()) router.dismissAll();
        router.push({ pathname: "/cancelled", params: { kind: "me" } });
      },
    });

  function pickReminder(minutes) {
    setPicking(false);
    updateSession({ remindMin: minutes });
    schedulePickupReminder(walkMin, meet);
    refresh((n) => n + 1);
  }

  const dot = (square) => (
    <View style={{ width: rs(20), alignItems: "center" }}>
      <View style={{ width: rs(12), height: rs(12), borderRadius: square ? 3 : rs(6), borderWidth: square ? 0 : 2.5, borderColor: colors.text, backgroundColor: square ? colors.text : "transparent" }} />
    </View>
  );
  const pill = { flexDirection: "row", alignItems: "center", gap: rs(4), height: rs(30), borderRadius: rs(15), paddingLeft: rs(9), paddingRight: rs(10) };

  // A bigger map now that the walk card is gone; the ticket covers its bottom.
  const headerH = Math.max(insets.top + rs(240), Math.round(height * 0.46));
  return (
    <View style={{ flex: 1, backgroundColor: page }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + rs(150) }} bounces={false}>
        <View style={{ height: headerH }}>
          <LiveMap
            route={plan?.route.coords}
            walks={walk ? [walk.coords] : []}
            walkColor={colors.purple}
            pins={[
              ...(needsWalk ? [{ id: "me", kind: "start", coords: booking.pickup.coords }] : []),
              { id: "pickup", kind: "pickup", coords: meet ?? booking.pickup.coords },
              { id: "office", kind: "office", coords: booking.drop.coords },
            ]}
            // You, the pickup and the office (not the host's whole route from their home), clear of the buttons and ticket.
            fit={meet ? [booking.pickup.coords, meet, booking.drop.coords] : undefined}
            padding={{ top: insets.top + rs(70), bottom: rs(80), left: rs(56), right: rs(56) }}
          />
          <LinearGradient pointerEvents="none" colors={[page + "00", page]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: rs(80) }} />
          <View style={{ position: "absolute", top: insets.top + rs(8), left: rs(14) }}>
            <RoundButton icon="chevron-back" label="Go back" onPress={() => router.back()} />
          </View>
          <View pointerEvents="none" style={{ position: "absolute", top: insets.top + rs(16), alignSelf: "center", flexDirection: "row", alignItems: "center", gap: rs(6), backgroundColor: colors.green, borderRadius: rs(15), paddingHorizontal: rs(12), height: rs(30), elevation: 4 }}>
            <Ionicons name="checkmark" size={rs(15)} color={colors.onGreen} />
            <Text style={txt({ color: colors.onGreen, fontFamily: fonts.bold, fontSize: rf(13) })}>Seat confirmed</Text>
          </View>
        </View>

        {/* The ride ticket */}
        <View style={{ marginTop: -rs(56), marginHorizontal: rs(14), backgroundColor: colors.background, borderRadius: rs(22), elevation: 6, shadowColor: "#0F141E", shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }}>
          <View style={{ padding: rs(18), paddingBottom: rs(8), gap: rs(14) }}>
            <View>
              <Text accessibilityRole="header" style={txt({ fontFamily: fonts.extrabold, fontSize: rf(22), letterSpacing: -0.4 })}>
                You’re riding with {first}
              </Text>
              <Text style={txt({ color: colors.textMuted, fontSize: rf(14), marginTop: rs(2) })}>Tomorrow · pickup {withAmPm(h.time)}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: rs(12) }}>
              <Avatar initials={h.initials} gender={h.gender} color={h.color} size={rs(46)} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: rs(5) }}>
                  <Text style={txt({ fontFamily: fonts.bold, fontSize: rf(15.5) })}>{h.name}</Text>
                  <MaterialCommunityIcons name="check-decagram" size={rs(16)} color={colors.green} accessibilityLabel="Verified" />
                </View>
                <Text style={txt({ color: colors.textMuted, fontSize: rf(13) })}>{h.vehicle}</Text>
              </View>
              <Plate text={h.plate} />
            </View>
          </View>
          {/* Perforation: a dashed line with a notch at each edge. */}
          <View style={{ height: rs(24), justifyContent: "center" }}>
            <View style={{ marginHorizontal: rs(18), borderTopWidth: 2, borderStyle: "dashed", borderColor: colors.line }} />
            <View style={{ position: "absolute", left: -rs(12), width: rs(24), height: rs(24), borderRadius: rs(12), backgroundColor: page }} />
            <View style={{ position: "absolute", right: -rs(12), width: rs(24), height: rs(24), borderRadius: rs(12), backgroundColor: page }} />
          </View>
          <View style={{ padding: rs(18), paddingTop: rs(6), gap: rs(14) }}>
            {/* Pickup: the walk is one symbol (tap for walking directions); under the place, when to leave or be ready. */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: rs(10) }}>
              {dot(false)}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={txt({ fontFamily: fonts.bold, fontSize: rf(15.5) })}>{booking.pickup.name}</Text>
                <Text numberOfLines={1} style={txt({ fontFamily: fonts.bold, fontSize: rf(13), color: !ready ? colors.textMuted : p.walk ? colors.purple : colors.green })}>
                  {!ready ? "Pickup" : p.walk ? `Leave by ${withAmPm(go)}` : `Ready by ${withAmPm(go)}`}
                </Text>
              </View>
              {ready && p.walk ? (
                <Pressable
                  onPress={() => Linking.openURL(walkUrl(meet)).catch(() => {})}
                  accessibilityRole="button"
                  accessibilityLabel={`Walk ${walkMins} minutes to the pickup. Opens Google Maps`}
                  hitSlop={6}
                  style={({ pressed }) => [pill, { backgroundColor: colors.purple, opacity: pressed ? 0.85 : 1, elevation: 3 }]}
                >
                  <Ionicons name="walk" size={rs(15)} color={colors.onImage} />
                  <Text style={txt({ color: colors.onImage, fontFamily: fonts.extrabold, fontSize: rf(13) })}>{walkMins} min</Text>
                  <Ionicons name="chevron-forward" size={rs(13)} color={colors.onImage} />
                </Pressable>
              ) : ready ? (
                <View style={[pill, { backgroundColor: colors.green }]} accessible accessibilityLabel={`${first} picks you up at your spot`}>
                  <Ionicons name="checkmark" size={rs(14)} color={colors.onGreen} />
                  <Text style={txt({ color: colors.onGreen, fontFamily: fonts.extrabold, fontSize: rf(13) })}>At your spot</Text>
                </View>
              ) : null}
              <Text style={txt({ fontFamily: fonts.extrabold, fontSize: rf(16) })}>{h.time}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: rs(10) }}>
              {dot(true)}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={txt({ fontFamily: fonts.bold, fontSize: rf(15.5) })}>{booking.drop.name}</Text>
                <Text style={txt({ color: colors.textMuted, fontSize: rf(13) })}>{ride ? `Drop · ${ride.km.toFixed(1)} km ride` : "Drop"}</Text>
              </View>
              <Text style={txt({ fontFamily: fonts.extrabold, fontSize: rf(16) })}>{ride ? clockPlus(h.time, ride.minutes) : ""}</Text>
            </View>

            {/* What you pay, and the reminder (tap to change it or turn it off). */}
            <View style={{ flexDirection: "row", gap: rs(10) }}>
              <View style={{ flex: 0.8, backgroundColor: colors.surface, borderRadius: rs(14), padding: rs(12) }}>
                <Text style={txt({ color: colors.textMuted, fontSize: rf(12) })}>You pay</Text>
                <Text style={txt({ fontFamily: fonts.extrabold, fontSize: rf(17) })}>₹{ridePrice(h)}</Text>
                <Text style={txt({ color: colors.textMuted, fontSize: rf(12) })}>cash or UPI</Text>
              </View>
              <Pressable
                onPress={() => setPicking(true)}
                disabled={!ready}
                accessibilityRole="button"
                accessibilityLabel={p.off ? "Reminder off. Change" : `Reminder at ${withAmPm(remindAt)}, ${p.before} minutes before ${p.walk ? "you leave" : "pickup"}. Change`}
                style={({ pressed }) => ({ flex: 1.2, flexDirection: "row", alignItems: "center", gap: rs(8), backgroundColor: colors.greenSurface, borderRadius: rs(14), padding: rs(12), opacity: pressed ? 0.85 : 1 })}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: rs(4) }}>
                    <Ionicons name={p.off ? "notifications-off-outline" : "notifications-outline"} size={rs(13)} color={colors.green} />
                    <Text style={txt({ color: colors.green, fontSize: rf(12) })}>Reminder</Text>
                  </View>
                  <Text style={txt({ color: colors.green, fontFamily: fonts.extrabold, fontSize: rf(17) })}>{!ready ? "…" : p.off ? "Off" : withAmPm(remindAt)}</Text>
                  <Text numberOfLines={1} style={txt({ color: colors.green, fontSize: rf(12) })}>
                    {!ready ? "Working it out" : p.off ? "Tap to turn on" : `${p.before} min before ${p.walk ? "you leave" : "pickup"}`}
                  </Text>
                </View>
                <Ionicons name="create-outline" size={rs(17)} color={colors.green} />
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={{ position: "absolute", left: rs(14), right: rs(14), bottom: insets.bottom + rs(10), gap: rs(10) }}>
        <View style={{ flexDirection: "row", gap: rs(10) }}>
          <Pressable onPress={() => call(h.phone)} accessibilityRole="button" accessibilityLabel={`Call ${first}`} style={({ pressed }) => ({ flex: 1, height: rs(54), borderRadius: rs(27), backgroundColor: colors.background, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: rs(8), elevation: 2, opacity: pressed ? 0.85 : 1 })}>
            <Ionicons name="call-outline" size={rs(18)} color={colors.text} />
            <Text style={txt({ fontFamily: fonts.bold, fontSize: rf(15.5) })}>Call</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/coming")} accessibilityRole="button" style={({ pressed }) => ({ flex: 2, height: rs(54), borderRadius: rs(27), backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1 })}>
            <Text style={txt({ color: colors.onInk, fontFamily: fonts.bold, fontSize: rf(15.5) })}>Track ride</Text>
          </Pressable>
        </View>
        <Pressable onPress={cancel} accessibilityRole="button" hitSlop={8} style={{ alignSelf: "center", paddingVertical: rs(4) }}>
          <Text style={txt({ color: colors.danger, fontFamily: fonts.bold, fontSize: rf(14.5) })}>Cancel ride</Text>
        </Pressable>
      </View>

      {picking ? (
        <ReminderSheet
          plan={p}
          h={h}
          subtitle={p.walk ? `You leave home at ${withAmPm(go)} for the ${walkMins} min walk.` : `Be ready at ${booking.pickup.name} by ${withAmPm(go)}.`}
          onDone={pickReminder}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </View>
  );
}
