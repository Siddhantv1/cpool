import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LiveMap from "../components/LiveMap";
import { Avatar, RoundButton } from "../components/RideUI";
import { fonts, useTheme } from "../constants/theme";
import { playAlert } from "../lib/alerts";
import { useRoute } from "../lib/directions";
import { HOSTS, OFFICES } from "../lib/mock";
import { ampm } from "../lib/requestSeat";
import { getSession, updateSession } from "../lib/session";
import { clearBooking, getTrips, ridePrice } from "../lib/trips";

// kind: "host" = the host cancelled, "declined" = the host said no to your request, "me" = you cancelled.
const COPY = {
  host: { badge: "Ride cancelled", title: (n) => `${n} cancelled the ride`, who: (n) => `${n}’s reason`, line: (r) => `“${r ?? "Plans changed"}” · your other requests are still open` },
  declined: { badge: "Request declined", title: (n) => `${n} can’t take you`, who: (n) => `${n} said no this time`, line: () => "It’s usually a full car or a change of route." },
  me: { badge: "Ride cancelled", title: () => "You cancelled", who: (n) => `${n} has been told`, line: (r) => `Your reason: ${(r ?? "plans changed").toLowerCase()}` },
};

// One ride in the "Other rides" list: time, host, last seat / spare helmet, walk, vehicle, price.
function OtherRide({ host, divider, onPress }) {
  const { colors, rs, rf } = useTheme();
  const extra = host.seatsFree === 1 ? "last seat" : host.type === "bike" && host.helmet ? "spare helmet" : null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${host.name}, leaves ${host.time} ${ampm(host.time)}, ${host.walkTo} walk, ${host.vehicle}, ${ridePrice(host)} rupees${extra ? `, ${extra}` : ""}`}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: rs(12), paddingVertical: rs(12), borderBottomWidth: divider ? 1 : 0, borderColor: colors.line, opacity: pressed ? 0.6 : 1 })}
    >
      <Text style={{ width: rs(50), color: colors.text, fontFamily: fonts.extrabold, fontSize: rf(18), letterSpacing: -0.3 }}>{host.time}</Text>
      <Avatar initials={host.initials} gender={host.gender} color={host.color} size={rs(36)} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontFamily: fonts.bold, fontSize: rf(14.5) }}>{host.name}</Text>
        <Text numberOfLines={1} style={{ color: colors.textMuted, fontFamily: fonts.regular, fontSize: rf(12.5) }}>
          {extra ? <Text style={{ fontFamily: fonts.bold, color: extra === "last seat" ? colors.warning : colors.purple }}>{extra} · </Text> : null}
          {host.walkTo} walk · {host.vehicle}
        </Text>
      </View>
      <Text style={{ color: colors.text, fontFamily: fonts.extrabold, fontSize: rf(15) }}>₹{ridePrice(host)}</Text>
    </Pressable>
  );
}

// Approved design (round 3): the route on a grey map under a red badge, a ticket with the trip and who was told, then
// a list of other rides and a switch for news of new rides.
export default function Cancelled() {
  const { colors, rs, rf } = useTheme();
  const insets = useSafeAreaInsets();
  const { kind = "host" } = useLocalSearchParams();
  const copy = COPY[kind] ?? COPY.host;
  const booking = getTrips().booking;
  const host = booking?.host ?? HOSTS[0];
  const first = host.name.split(" ")[0];
  const pickup = booking?.pickup;
  const drop = booking?.drop ?? OFFICES[0];
  const ride = useRoute(pickup?.coords ? [pickup.coords, drop.coords] : null);
  const others = HOSTS.filter((h) => h.id !== host.id && h.seatsFree > 0); // full rides aren't offered
  const office = OFFICES.find((o) => o.name === drop.name) ?? OFFICES[0];
  const to = drop.short ?? drop.name;
  const page = colors.surface;
  const txt = (style) => [{ color: colors.text, fontFamily: fonts.regular }, style];
  // shortcut: only remembered with your profile on this phone; the backend should send a push when someone publishes a
  // ride to this office around this time (asked in cmem-A A37).
  const [newRides, setNewRides] = useState(() => !!getSession()?.newRideAlerts);
  const toggleNewRides = (on) => {
    setNewRides(on);
    updateSession({ newRideAlerts: on });
  };

  useEffect(() => {
    // The decline sound already played on the screen that showed it; you don't need a sound for your own cancel.
    if (kind === "host") playAlert("cancelled");
    return () => clearBooking();
  }, [kind]);

  const headerH = insets.top + rs(160);
  return (
    <View style={{ flex: 1, backgroundColor: page }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + rs(96) }} bounces={false}>
        <View style={{ height: headerH }}>
          {/* Grey map and route: the trip isn't happening any more. */}
          {pickup?.coords ? (
            <LiveMap muted route={ride?.coords} pins={[{ id: "office", kind: "office", coords: drop.coords }]} padding={{ top: insets.top + rs(56), bottom: rs(60), left: rs(56), right: rs(56) }} />
          ) : null}
          <LinearGradient pointerEvents="none" colors={[page + "00", page]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: rs(70) }} />
          <View style={{ position: "absolute", top: insets.top + rs(8), left: rs(14) }}>
            <RoundButton icon="chevron-back" label="Go back" onPress={() => router.back()} />
          </View>
          <View pointerEvents="none" style={{ position: "absolute", top: insets.top + rs(16), alignSelf: "center", flexDirection: "row", alignItems: "center", gap: rs(6), backgroundColor: colors.danger, borderRadius: rs(15), paddingHorizontal: rs(12), height: rs(30), elevation: 4 }}>
            <Ionicons name="close" size={rs(15)} color={colors.onImage} />
            <Text style={txt({ color: colors.onImage, fontFamily: fonts.bold, fontSize: rf(13) })}>{copy.badge}</Text>
          </View>
        </View>

        <View style={{ marginTop: -rs(56), marginHorizontal: rs(14), backgroundColor: colors.background, borderRadius: rs(22), elevation: 6, shadowColor: "#0F141E", shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }}>
          <View style={{ padding: rs(18), paddingBottom: rs(8) }}>
            <Text accessibilityRole="header" style={txt({ fontFamily: fonts.extrabold, fontSize: rf(22), letterSpacing: -0.4 })}>
              {copy.title(first)}
            </Text>
            <Text style={txt({ color: colors.textMuted, fontSize: rf(14), marginTop: rs(2) })}>
              Tomorrow · {host.time} {ampm(host.time)} with {host.name}
            </Text>
          </View>
          <View style={{ height: rs(24), justifyContent: "center" }}>
            <View style={{ marginHorizontal: rs(18), borderTopWidth: 2, borderStyle: "dashed", borderColor: colors.line }} />
            <View style={{ position: "absolute", left: -rs(12), width: rs(24), height: rs(24), borderRadius: rs(12), backgroundColor: page }} />
            <View style={{ position: "absolute", right: -rs(12), width: rs(24), height: rs(24), borderRadius: rs(12), backgroundColor: page }} />
          </View>
          <View style={{ padding: rs(16), paddingTop: rs(4), gap: rs(14) }}>
            {/* The trip, as a quiet Pickup → Drop summary. */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: rs(10), backgroundColor: colors.surface, borderRadius: rs(16), padding: rs(12) }} accessible accessibilityLabel={`Pickup ${pickup?.name ?? ""} at ${host.time}, drop ${drop.name}`}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={txt({ color: colors.textMuted, fontFamily: fonts.bold, fontSize: rf(11) })}>
                  PICKUP · {host.time} {ampm(host.time)}
                </Text>
                <Text numberOfLines={1} style={txt({ fontFamily: fonts.bold, fontSize: rf(14) })}>
                  {pickup?.name ?? "Your pickup"}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={rs(16)} color={colors.textMuted} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={txt({ color: colors.textMuted, fontFamily: fonts.bold, fontSize: rf(11) })}>DROP</Text>
                <Text numberOfLines={1} style={txt({ fontFamily: fonts.bold, fontSize: rf(14) })}>
                  {drop.name}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: rs(12) }}>
              <View>
                <Avatar initials={host.initials} gender={host.gender} color={host.color} size={rs(42)} />
                {kind === "me" ? (
                  <View style={{ position: "absolute", right: -rs(3), bottom: -rs(3), width: rs(20), height: rs(20), borderRadius: rs(10), backgroundColor: colors.green, borderWidth: 2, borderColor: colors.background, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="checkmark" size={rs(11)} color={colors.onGreen} />
                  </View>
                ) : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={txt({ fontFamily: fonts.bold, fontSize: rf(15) })}>{copy.who(first)}</Text>
                <Text style={txt({ color: colors.textMuted, fontSize: rf(13), lineHeight: rf(18) })}>{copy.line(booking?.reason)}</Text>
              </View>
            </View>
          </View>
        </View>

        {others.length ? (
          <View style={{ marginTop: rs(18), marginHorizontal: rs(14), gap: rs(10) }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: rs(2) }}>
              <Text accessibilityRole="header" style={txt({ fontFamily: fonts.extrabold, fontSize: rf(17) })}>Other rides to {to}</Text>
              <Pressable onPress={() => router.replace("/results")} accessibilityRole="button" accessibilityLabel={`See all ${others.length} rides`} hitSlop={8}>
                <Text style={txt({ color: colors.primary, fontFamily: fonts.bold, fontSize: rf(13.5) })}>See all</Text>
              </Pressable>
            </View>
            <View style={{ backgroundColor: colors.background, borderRadius: rs(20), paddingHorizontal: rs(14) }}>
              {others.slice(0, 3).map((h, i, shown) => (
                <OtherRide key={h.id} host={h} divider={i < shown.length - 1} onPress={() => router.push({ pathname: "/pickup-map", params: { id: h.id, office: office.id } })} />
              ))}
            </View>
          </View>
        ) : null}
        <View style={{ marginTop: rs(10), marginHorizontal: rs(14), flexDirection: "row", alignItems: "center", gap: rs(12), backgroundColor: colors.background, borderRadius: rs(18), padding: rs(12), paddingLeft: rs(14) }}>
          <View style={{ width: rs(38), height: rs(38), borderRadius: rs(12), backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="notifications-outline" size={rs(18)} color={colors.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={txt({ fontFamily: fonts.bold, fontSize: rf(14.5) })}>Tell me about new rides</Text>
            <Text style={txt({ color: colors.textMuted, fontSize: rf(12.5) })}>
              To {to} around {host.time} {ampm(host.time)} tomorrow
            </Text>
          </View>
          <Switch value={newRides} onValueChange={toggleNewRides} accessibilityLabel="Tell me about new rides" />
        </View>
      </ScrollView>

      <View style={{ position: "absolute", left: rs(14), right: rs(14), bottom: insets.bottom + rs(12) }}>
        <Pressable onPress={() => router.replace("/results")} accessibilityRole="button" style={({ pressed }) => ({ height: rs(54), borderRadius: rs(27), backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1 })}>
          <Text style={txt({ color: colors.onInk, fontFamily: fonts.bold, fontSize: rf(15.5) })}>Find another ride</Text>
        </Pressable>
      </View>
    </View>
  );
}
