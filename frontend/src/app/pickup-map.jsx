import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, useLocalSearchParams } from "expo-router";
import { Linking, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LiveMap from "../components/LiveMap";
import { Avatar, MapSheet, RoundButton, Stops } from "../components/RideUI";
import { useTheme } from "../constants/theme";
import { goBack } from "../lib/nav";
import { clockPlus, useMeetRoute, useRoute, walkLabel } from "../lib/directions";
import { OFFICES } from "../lib/mock";
import { km } from "../lib/route";
import { hostById, myPickup, useTrips } from "../lib/trips";
import { useArea } from "../lib/useArea";

// Where you meet this host: their whole route from where they start (grey until you join), your walk to the
// closest point on it (dotted), then the ride to the office.
// shortcut: hosts and their start points are example data; real routes come from the backend's ride data.
export default function PickupMap() {
  const { colors, spacing, fontSize, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { id, office } = useLocalSearchParams();
  useTrips(); // re-render when the chosen pickup changes
  const area = useArea();
  const h = hostById(id);
  const me = myPickup(area);
  const drop = OFFICES.find((o) => o.id === office) ?? OFFICES[0];
  const plan = useMeetRoute(h?.start, drop.coords, me.coords);
  const meet = plan?.meet ?? null; // null until the host's route has loaded
  const needsWalk = !!meet && km(me.coords, meet) > 0.03;
  const walk = useRoute(needsWalk ? [me.coords, meet] : null, "walking");
  if (!h) return <Redirect href="/home" />;

  const pins = [{ id: "me", kind: "start", coords: me.coords }, ...(meet ? [{ id: "pickup", kind: "pickup", coords: meet }] : []), { id: "office", kind: "office", coords: drop.coords }];
  const walkText = !plan ? "Working out where to meet…" : walk ? `${walkLabel(walk.km)} · ${Math.max(1, Math.round(walk.minutes))} min walk from ${me.here ? "you" : me.name}` : needsWalk ? "Working out the walk…" : "Right where you are";
  const walkDirections = () => meet && Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${meet[1]},${meet[0]}&travelmode=walking`);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1 }}>
        <LiveMap
          route={plan?.route.coords}
          done={plan?.toMeet.coords}
          walks={walk ? [walk.coords] : []}
          pins={pins}
          vehicle={plan ? { point: h.start, heading: 0, type: h.type } : null} padding={{ top: 90, bottom: 40, left: 50, right: 50 }} />
        <View style={{ position: "absolute", top: insets.top + spacing.sm, left: spacing.md }}>
          <RoundButton icon="arrow-back" label="Go back" onPress={goBack} />
        </View>
      </View>

      <MapSheet>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Avatar initials={h.initials} color={h.color} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md }}>{h.name}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <MaterialCommunityIcons name={h.type === "bike" ? "motorbike" : "car"} size={14} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }} numberOfLines={1}>
                {h.vehicle} · from {h.from}
              </Text>
            </View>
          </View>
        </View>
        <Stops
          stops={[
            { title: "Meet point", subtitle: walkText, time: h.time },
            { title: drop.name, subtitle: plan ? `Ride ${plan.fromMeet.km.toFixed(1)} km · about ${Math.max(1, Math.round(plan.fromMeet.minutes))} min in traffic now` : "Working out the route…", time: plan ? clockPlus(h.time, plan.fromMeet.minutes) : "" },
          ]}
        />
        {walk ? (
          <Pressable onPress={walkDirections} accessibilityRole="button" style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing.sm, backgroundColor: colors.ink, borderRadius: radius.lg, paddingVertical: spacing.md }}>
            <Ionicons name="walk" size={18} color={colors.onInk} />
            <Text style={{ color: colors.onInk, fontWeight: "800", fontSize: fontSize.md }}>Open in Google Maps</Text>
          </Pressable>
        ) : plan && !needsWalk ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md }}>
            <Ionicons name="location" size={18} color={colors.text} />
            <Text style={{ flex: 1, color: colors.text, fontSize: fontSize.sm }}>{h.name.split(" ")[0]}’s route passes right where you are.</Text>
          </View>
        ) : null}
      </MapSheet>
    </View>
  );
}
