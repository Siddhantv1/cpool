import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Pressable, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import LiveMap from "../components/LiveMap";
import { Avatar, RequestStatus, RideConfirmed, RoundButton, TripLegs } from "../components/RideUI";
import { useTheme } from "../constants/theme";
import { useMeetRoute, useRoute, walkLabel, walkUrl } from "../lib/directions";
import { useMapControl } from "../lib/mapControl";
import { OFFICES } from "../lib/mock";
import { goBack } from "../lib/nav";
import { pickupWindow, requestSeat, useOpenRideWhenAccepted } from "../lib/requestSeat";
import { km } from "../lib/route";
import { confirmWithdraw, hostById, myPickup, ridePrice, useTrips } from "../lib/trips";
import { useArea } from "../lib/useArea";

// A small box around a point, so the camera zooms in on it (See pickup / See drop).
const around = ([lng, lat]) => [
  [lng - 0.004, lat - 0.003],
  [lng + 0.004, lat + 0.003],
];

// The map's recenter button. It listens to the map's controls on its own, so the map re-registering them on every
// render only re-renders this button, not the whole screen (which would loop forever).
function Recenter({ onPress }) {
  const { colors, spacing } = useTheme();
  const map = useMapControl();
  if (!map) return null;
  return (
    <View style={{ position: "absolute", right: spacing.md, bottom: spacing.md }}>
      <RoundButton icon={map.onMe ? "map-outline" : "locate"} label={map.onMe ? "Show the whole trip" : "Show my location"} color={colors.primary} onPress={() => (onPress(), map.recenter())} />
    </View>
  );
}

// See on map: where you get in (PICKUP) and get out (DROP) with this host, the host's drive before the pickup (grey),
// your walk to the pickup (dotted), the vehicle, and Request Ride.
// shortcut: hosts and their start points are example data; real routes come from the backend's ride data.
export default function PickupMap() {
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  const insets = useSafeAreaInsets();
  const { id, office, when = "Tomorrow · 8:30 AM" } = useLocalSearchParams();
  const { booking } = useTrips();
  const area = useArea();
  useOpenRideWhenAccepted();
  const [focus, setFocus] = useState(null); // null = whole trip | "pickup" | "drop"
  const [info, setInfo] = useState(false);
  const h = hostById(id);
  const me = myPickup(area);
  const drop = OFFICES.find((o) => o.id === office) ?? OFFICES[0];
  const plan = useMeetRoute(h?.start, drop.coords, me.coords);
  const meet = plan?.meet ?? null; // null until the host's route has loaded
  const needsWalk = !!meet && km(me.coords, meet) > 0.03;
  const walk = useRoute(needsWalk ? [me.coords, meet] : null, "walking");
  if (!h) return <Redirect href="/home" />;

  const first = h.name.split(" ")[0];
  const status = booking?.host.id === h.id ? booking.status : null;
  const pins = [
    { id: "me", kind: "start", coords: me.coords },
    ...(meet ? [{ id: "pickup", kind: "tag", label: "PICKUP", icon: "car-door", tone: colors.primary, coords: meet }] : []),
    { id: "drop", kind: "tag", label: "DROP", icon: "office-building", tone: "#0F172A", coords: drop.coords },
  ];
  const fit = focus === "pickup" && meet ? around(meet) : focus === "drop" ? around(drop.coords) : undefined;
  const walkDirections = () => meet && Linking.openURL(walkUrl(meet));
  const plate = h.plate ? `•• •• •• ${h.plate.replace(/\s/g, "").slice(-4)}` : "";
  const strip = (key, label) => (
    <Pressable
      onPress={() => setFocus(focus === key ? null : key)}
      disabled={key === "pickup" && !meet}
      accessibilityRole="button"
      accessibilityState={{ selected: focus === key }}
      accessibilityLabel={focus === key ? `${label}. Tap to show the whole trip` : label}
      style={{ height: rs(40), flexDirection: "row", alignItems: "center", gap: rs(5), paddingHorizontal: spacing.sm + 4, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.text, backgroundColor: focus === key ? colors.text : colors.background }}
    >
      <Ionicons name="location-outline" size={rs(17)} color={focus === key ? colors.background : colors.text} />
      <Text style={{ color: focus === key ? colors.background : colors.text, fontWeight: "600", fontSize: rf(14) }}>{label}</Text>
    </Pressable>
  );
  const legend = (line, text) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
      {line}
      <Text style={{ color: colors.text, fontSize: rf(12.5) }}>{text}</Text>
    </View>
  );

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingLeft: rs(2), paddingRight: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.md - 2, borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={6} style={{ width: rs(40), height: rs(44), alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-back" size={rs(26)} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0, gap: rs(4) }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: rs(5) }}>
            <Text style={{ color: colors.textMuted, fontSize: rf(13.5), flexShrink: 1 }} numberOfLines={1}>
              {me.here ? "Current location" : me.name}
            </Text>
            <Ionicons name="arrow-forward" size={rs(14)} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, fontSize: rf(13.5), flexShrink: 1 }} numberOfLines={1}>
              {drop.name}
            </Text>
          </View>
          <Text style={{ color: colors.text, fontSize: rf(15), fontWeight: "600" }}>{when.replace(" · ", ", ")}</Text>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <LiveMap
          route={plan?.route.coords}
          done={plan?.toMeet.coords}
          walks={walk ? [walk.coords] : []}
          pins={pins}
          fit={fit}
          vehicle={plan ? { point: h.start, heading: 0, type: h.type } : null}
          padding={{ top: rs(90), bottom: rs(40), left: rs(50), right: rs(50) }}
        />
        <Recenter onPress={() => setFocus(null)} />
        {info ? (
          <View accessibilityLabel="Map info" style={{ position: "absolute", left: spacing.md, bottom: spacing.md, backgroundColor: colors.background, borderRadius: radius.lg, padding: spacing.sm + 4, gap: spacing.sm, borderWidth: 1, borderColor: colors.line, elevation: 6, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10 }}>
            <Text style={{ color: colors.textMuted, fontSize: rf(11), fontWeight: "800", letterSpacing: 1 }}>MAP INFO</Text>
            {legend(<View style={{ width: rs(22), height: 4, borderRadius: 2, backgroundColor: colors.route }} />, `Your ride with ${first}`)}
            {legend(<View style={{ width: rs(22), height: 4, borderRadius: 2, backgroundColor: colors.textMuted }} />, `${first}’s drive before pickup`)}
            {legend(<View style={{ width: rs(22), borderTopWidth: 3, borderStyle: "dotted", borderColor: colors.textMuted }} />, "You walk")}
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm - 2, paddingHorizontal: spacing.md - 2, paddingVertical: spacing.sm + 4, backgroundColor: colors.primarySurface }}>
        <Pressable onPress={() => setInfo(!info)} accessibilityRole="button" accessibilityState={{ expanded: info }} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: rs(6), marginRight: "auto" }}>
          <Ionicons name="map-outline" size={rs(19)} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: "600", fontSize: rf(14) }}>Map info</Text>
        </Pressable>
        {strip("pickup", "See pickup")}
        {strip("drop", "See drop")}
      </View>

      <View style={{ backgroundColor: colors.background, paddingHorizontal: spacing.md, paddingTop: spacing.sm + 2, paddingBottom: insets.bottom + spacing.md, gap: spacing.md - 2 }}>
        <View style={{ alignSelf: "center", width: rs(40), height: rs(5), borderRadius: rs(5), backgroundColor: colors.line }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md - 2 }}>
          <View style={{ padding: 3, borderRadius: rs(40), borderWidth: 1, borderColor: colors.line }}>
            <Avatar initials={h.initials} gender={h.gender} color={h.color} size={rs(58)} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: rs(3) }}>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: rf(17.5) }} numberOfLines={1}>
              {h.name}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: rs(5) }}>
              <Text style={{ color: colors.textMuted, fontSize: rf(14), flexShrink: 1 }} numberOfLines={1}>
                {h.vehicle}
              </Text>
              <MaterialCommunityIcons name="check-decagram" size={rs(17)} color={colors.green} accessibilityLabel="Verified" />
            </View>
            <Text style={{ color: colors.textMuted, fontSize: rf(14) }} numberOfLines={1}>
              Pickup by <Text style={{ color: colors.text, fontWeight: "600" }}>{pickupWindow(h.time)}</Text>
            </Text>
          </View>
        </View>

        <TripLegs host={h} />

        {walk ? (
          <Pressable
            onPress={walkDirections}
            accessibilityRole="link"
            accessibilityLabel={`Walk ${walkLabel(walk.km)} to the pickup. Opens Google Maps`}
            style={({ pressed }) => ({ height: rs(44), flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: pressed ? colors.primarySurface : colors.background })}
          >
            <MaterialCommunityIcons name="walk" size={rs(18)} color={colors.primary} />
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: rf(14) }}>Walk to pickup</Text>
            <Ionicons name="open-outline" size={rs(15)} color={colors.primary} />
          </Pressable>
        ) : plan && !needsWalk ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.sm + 4 }}>
            <Ionicons name="location" size={rs(18)} color={colors.text} />
            <Text style={{ flex: 1, color: colors.text, fontSize: fontSize.sm }}>{first}’s route passes right where you are.</Text>
          </View>
        ) : null}

        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.cardLine, borderRadius: radius.lg, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md - 2 }}>
          <View style={{ flex: 1, gap: rs(2) }}>
            {plate ? <Text style={{ color: colors.text, fontWeight: "700", fontSize: rf(16), letterSpacing: 1 }}>{plate}</Text> : null}
            <Text style={{ color: colors.textMuted, fontSize: rf(12.5), letterSpacing: 0.4 }} numberOfLines={1}>
              {h.vehicle.toUpperCase()} ({h.type === "bike" ? "Bike" : "Car"})
            </Text>
          </View>
          <View style={{ width: rs(56), height: rs(40), borderRadius: rs(12), backgroundColor: colors.primarySurface, alignItems: "center", justifyContent: "center" }}>
            <MaterialCommunityIcons name={h.type === "bike" ? "moped" : "car-side"} size={rs(28)} color={colors.primary} />
          </View>
        </View>

        {status === "accepted" ? (
          <RideConfirmed name={first} onOpen={() => router.push("/accepted")} />
        ) : status === "requested" ? (
          <RequestStatus name={first} onCancel={() => confirmWithdraw()} />
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
            <View style={{ gap: rs(2) }}>
              {/* Price the guest pays the host, same as on the ride card; ⓘ explains it. */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: rs(6) }}>
                <Text style={{ color: colors.primary, fontSize: rf(24), fontWeight: "800" }} accessibilityLabel={`${ridePrice(h)} rupees per seat`}>
                  ₹{ridePrice(h)}
                </Text>
                <Pressable
                  onPress={() => Alert.alert("About this price", `A share of the fuel for the ${h.ride} you ride together. Pay ${first} in cash or UPI; nothing is paid in the app.`)}
                  accessibilityRole="button"
                  accessibilityLabel="About this price"
                  hitSlop={8}
                >
                  <Ionicons name="information-circle-outline" size={rs(19)} color={colors.textMuted} />
                </Pressable>
              </View>
              <Text style={{ color: colors.textMuted, fontSize: rf(13.5), fontWeight: "500" }}>
                {h.seatsFree} seat{h.seatsFree === 1 ? "" : "s"} left
              </Text>
            </View>
            <Pressable
              onPress={() => requestSeat(h.id, drop, me)}
              accessibilityRole="button"
              accessibilityLabel={`Request a seat with ${first}`}
              style={({ pressed }) => ({
                height: rs(52),
                paddingHorizontal: spacing.lg + 2,
                justifyContent: "center",
                borderRadius: radius.lg,
                backgroundColor: colors.primary,
                borderBottomWidth: pressed ? 2 : 4,
                borderBottomColor: colors.primaryEdge,
                transform: [{ translateY: pressed ? 2 : 0 }],
              })}
            >
              <Text style={{ color: colors.onPrimary, fontWeight: "700", fontSize: fontSize.md }}>Request Ride</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
