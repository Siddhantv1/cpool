import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, router } from "expo-router";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LiveMap from "../components/LiveMap";
import MeetMap from "../components/MeetMap";
import { Avatar, call, Plate, RoundButton, Stops } from "../components/RideUI";
import { fonts, useTheme } from "../constants/theme";
import { confirmSheet } from "../lib/confirm";
import { clockPlus, useMeetRoute, useRoute, walkLabel } from "../lib/directions";
import { ampm } from "../lib/requestSeat";
import { km } from "../lib/route";
import { ridePrice, useTrips, withdrawBooking } from "../lib/trips";

const REASONS = ["My plans changed", "I found another ride", "Pickup point is too far", "Host asked me to cancel", "Something else"];
const REMIND_MIN = 15; // same as the reminder scheduled in lib/notify.js

// Your seat is confirmed (approved design): your route on top, a ride ticket (host, trip, price, reminder), then the
// meet point card: your walk on a street map and when to leave.
export default function Accepted() {
  const { colors, rs, rf } = useTheme();
  const insets = useSafeAreaInsets();
  const { booking } = useTrips();
  const ride = useRoute(booking ? [booking.pickup.coords, booking.drop.coords] : null);
  // Where you meet the host: the closest point on their route, and your walk there (same as "host on the way").
  const plan = useMeetRoute(booking?.host.start, booking?.drop.coords, booking?.pickup.coords);
  const meet = plan?.meet ?? null;
  const needsWalk = !!meet && km(booking.pickup.coords, meet) > 0.03;
  const walk = useRoute(needsWalk ? [booking.pickup.coords, meet] : null, "walking");
  if (!booking) return <Redirect href="/home" />;
  // Cancelling moves on to the Cancelled screen; render nothing meanwhile instead of also redirecting.
  if (booking.status !== "accepted") return null;
  const h = booking.host;
  const first = h.name.split(" ")[0];
  const page = colors.surface;
  const txt = (style) => [{ color: colors.text, fontFamily: fonts.regular }, style];
  const ready = !!meet && (!needsWalk || !!walk);
  const leave = walk ? clockPlus(h.time, -(Math.ceil(walk.minutes) + 1)) : null; // a minute to spare
  const meetTitle = !ready ? "Your pickup point" : walk ? `Leave by ${leave} ${ampm(leave)}` : `${first} picks you up here`;
  const meetText = !ready ? "Working out your walk…" : walk ? `${walkLabel(walk.km)} walk to the pickup` : `Be there by ${h.time} ${ampm(h.time)}`;

  // One sheet with the reasons (replaces the old Cancel your ride page), then the Cancelled screen.
  const cancel = () =>
    confirmSheet({
      title: "Cancel your ride?",
      text: `${first} is keeping a seat for you tomorrow at ${h.time} ${ampm(h.time)}.`,
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

  const headerH = insets.top + rs(180);
  return (
    <View style={{ flex: 1, backgroundColor: page }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + rs(150) }} bounces={false}>
        <View style={{ height: headerH }}>
          <LiveMap
            route={ride?.coords}
            pins={[
              { id: "pickup", kind: "start", coords: booking.pickup.coords },
              { id: "office", kind: "office", coords: booking.drop.coords },
            ]}
            // Frames the whole trip between the buttons on top and the ticket that covers the bottom of the map.
            padding={{ top: insets.top + rs(60), bottom: rs(66), left: rs(56), right: rs(56) }}
          />
          <LinearGradient pointerEvents="none" colors={["rgba(255,255,255,0)", page]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: rs(80) }} />
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
              <Text style={txt({ color: colors.textMuted, fontSize: rf(14), marginTop: rs(2) })}>
                Tomorrow · pickup {h.time} {ampm(h.time)}
              </Text>
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
            <Stops
              stops={[
                { title: booking.pickup.name, subtitle: "Pickup", time: h.time },
                { title: booking.drop.name, subtitle: ride ? `Drop · ${ride.km.toFixed(1)} km ride` : "Drop", time: ride ? clockPlus(h.time, ride.minutes) : "" },
              ]}
            />
            <View style={{ flexDirection: "row", gap: rs(10) }}>
              <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: rs(14), padding: rs(12) }}>
                <Text style={txt({ color: colors.textMuted, fontSize: rf(12) })}>You pay</Text>
                <Text style={txt({ fontFamily: fonts.extrabold, fontSize: rf(17) })}>
                  ₹{ridePrice(h)} <Text style={txt({ color: colors.textMuted, fontSize: rf(12) })}>cash or UPI</Text>
                </Text>
              </View>
              <View style={{ flex: 1, backgroundColor: colors.greenSurface, borderRadius: rs(14), padding: rs(12) }}>
                <Text style={txt({ color: colors.green, fontSize: rf(12) })}>Reminder</Text>
                <Text style={txt({ color: colors.green, fontFamily: fonts.extrabold, fontSize: rf(17) })}>
                  {clockPlus(h.time, -REMIND_MIN)} {ampm(clockPlus(h.time, -REMIND_MIN))}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Meet point card (approved round 3): a street map of your walk, with when to leave floating on it. */}
        <View style={{ marginTop: rs(14), marginHorizontal: rs(14), height: rs(220), borderRadius: rs(22), overflow: "hidden", backgroundColor: colors.background, elevation: 2 }}>
          {ready ? (
            <View style={{ flex: 1 }} accessible accessibilityLabel={walk ? `Map of your ${walkLabel(walk.km)} walk to the pickup point` : "Map of the pickup point"}>
              <MeetMap
                route={plan.route.coords}
                walk={walk?.coords ?? null}
                meet={meet}
                me={booking.pickup.coords}
                time={h.time}
                type={h.type}
                minutes={walk ? Math.max(1, Math.round(walk.minutes)) : 0}
                padding={{ paddingTop: rs(84), paddingBottom: rs(80), paddingLeft: rs(48), paddingRight: rs(48) }}
              />
            </View>
          ) : (
            <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", paddingTop: rs(60) }}>
              <ActivityIndicator color={colors.textMuted} />
            </View>
          )}
          <View style={{ position: "absolute", left: rs(10), right: rs(10), bottom: rs(10), flexDirection: "row", alignItems: "center", gap: rs(10), backgroundColor: colors.background, borderRadius: rs(18), paddingVertical: rs(10), paddingLeft: rs(16), paddingRight: rs(10), elevation: 4, shadowColor: "#0F141E", shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={txt({ fontFamily: fonts.extrabold, fontSize: rf(16) })}>{meetTitle}</Text>
              <Text numberOfLines={1} style={txt({ color: colors.textMuted, fontSize: rf(13) })}>{meetText}</Text>
            </View>
            {walk ? (
              <Pressable
                onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${meet[1]},${meet[0]}&travelmode=walking`).catch(() => {})}
                accessibilityRole="button"
                accessibilityLabel="Walking directions in Google Maps"
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: rs(5), backgroundColor: colors.ink, borderRadius: rs(20), paddingHorizontal: rs(16), height: rs(40), opacity: pressed ? 0.85 : 1 })}
              >
                <Ionicons name="walk" size={rs(16)} color={colors.onInk} />
                <Text style={txt({ color: colors.onInk, fontFamily: fonts.bold, fontSize: rf(14) })}>Walk</Text>
              </Pressable>
            ) : null}
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
    </View>
  );
}
