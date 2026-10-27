import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Linking, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LiveMap from "../components/LiveMap";
import { Avatar, MapSheet, RoundButton, Stops } from "../components/RideUI";
import { useTheme } from "../constants/theme";
import { OFFICES, PICKUP_INDEX, ROUTE, WALK_TO_PICKUP } from "../lib/mock";
import { hostById } from "../lib/trips";

const PICKUP = ROUTE[PICKUP_INDEX];
const PINS = [
  { id: "me", kind: "start", coords: WALK_TO_PICKUP[0] },
  { id: "pickup", kind: "pickup", coords: PICKUP },
  { id: "office", kind: "office", coords: OFFICES[0].coords },
];

// Where the pickup happens for one ride in the results: walk → ride → walk.
// shortcut: every example host uses the same route and pickup; the real ones come from the search API.
export default function PickupMap() {
  const { colors, spacing, fontSize, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const h = hostById(id);
  if (!h) return <Redirect href="/home" />;

  const walkDirections = () =>
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${PICKUP[1]},${PICKUP[0]}&travelmode=walking`);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1 }}>
        <LiveMap route={ROUTE.slice(PICKUP_INDEX)} walks={[WALK_TO_PICKUP]} pins={PINS} padding={{ top: 90, bottom: 40, left: 50, right: 50 }} />
        <View style={{ position: "absolute", top: insets.top + spacing.sm, left: spacing.md }}>
          <RoundButton icon="arrow-back" label="Go back" onPress={() => router.back()} />
        </View>
      </View>

      <MapSheet>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Avatar initials={h.initials} color={h.color} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md }}>{h.name}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <MaterialCommunityIcons name={h.type === "bike" ? "motorbike" : "car"} size={14} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{h.vehicle}</Text>
            </View>
          </View>
        </View>
        <Stops
          stops={[
            { title: "HSR Layout · 27th Main", subtitle: `Pickup · walk ${h.walkTo} from you`, time: h.time },
            { title: OFFICES[0].name, subtitle: `Ride ${h.ride} · walk ${h.walkFrom} to the door`, time: "9:15" },
          ]}
        />
        <Pressable
          onPress={walkDirections}
          accessibilityRole="button"
          style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing.sm, backgroundColor: colors.ink, borderRadius: radius.lg, paddingVertical: spacing.md }}
        >
          <Ionicons name="walk" size={18} color={colors.onInk} />
          <Text style={{ color: colors.onInk, fontWeight: "800", fontSize: fontSize.md }}>Walking directions to pickup</Text>
        </Pressable>
      </MapSheet>
    </View>
  );
}
