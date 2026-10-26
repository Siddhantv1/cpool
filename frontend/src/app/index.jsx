import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import Button from "../components/Button";
import Screen from "../components/Screen";
import { useTheme } from "../constants/theme";
import { getSession } from "../lib/session";

// "aswin.v@perficient.com" -> "Aswin"
const firstName = (email) => {
  const first = email.split("@")[0].split(/[._-]/)[0];
  return first.charAt(0).toUpperCase() + first.slice(1);
};

const comingSoon = () => Alert.alert("Coming soon", "This feature is not ready yet.");

export default function Home() {
  const session = getSession();
  const { added } = useLocalSearchParams();
  const { colors, spacing, fontSize, radius } = useTheme();
  const [showAdded, setShowAdded] = useState(added === "1");
  const [, refresh] = useState(0);

  // Re-read the session when coming back (e.g. the role was switched in Profile).
  useFocusEffect(useCallback(() => refresh((n) => n + 1), []));

  // Hide the "Vehicle added" message after a few seconds.
  useEffect(() => {
    if (!showAdded) return;
    const id = setTimeout(() => setShowAdded(false), 3500);
    return () => clearTimeout(id);
  }, [showAdded]);

  if (!session) return <Redirect href="/welcome" />;
  if (!session.role) return <Redirect href="/role" />;

  const vehicle = session.vehicle;
  const isHost = session.role === "host";

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: fontSize.xxl, fontWeight: "800" }}>
          Hi, {firstName(session.email)}
        </Text>
        <Pressable
          onPress={() => router.push("/profile")}
          accessibilityRole="button"
          accessibilityLabel="Profile"
          hitSlop={8}
          style={{ width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="person-circle-outline" size={28} color={colors.text} />
        </Pressable>
      </View>
      {showAdded ? (
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.successSurface, borderRadius: radius.md + 2, padding: spacing.sm + 4 }}
          accessibilityLiveRegion="polite"
        >
          <Ionicons name="checkmark" size={18} color={colors.success} />
          <Text style={{ color: colors.success, fontSize: fontSize.sm, fontWeight: "600" }}>Vehicle added. You&apos;re ready to host.</Text>
        </View>
      ) : null}
      {vehicle ? (
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md }}
          accessible
          accessibilityLabel={`Your vehicle: ${vehicle.model}, ${vehicle.number}`}
        >
          <View style={{ width: 52, height: 52, borderRadius: radius.md + 2, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
            <MaterialCommunityIcons name={vehicle.type === "bike" ? "motorbike" : "car-side"} size={28} color={colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: "700" }}>{vehicle.model}</Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
              {[vehicle.number, vehicle.colour, vehicle.type === "bike" ? "1 guest seat" : `${vehicle.seats} guest seats`].filter(Boolean).join(" · ")}
            </Text>
          </View>
        </View>
      ) : null}
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs }}>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Your next ride</Text>
        <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: "700" }}>None yet</Text>
      </View>
      {isHost ? (
        <>
          <Button title="Offer a ride" onPress={comingSoon} />
          <Button title="Find a ride" variant="secondary" onPress={comingSoon} />
        </>
      ) : (
        <>
          <Button title="Find a ride" onPress={comingSoon} />
          <Button title="Offer a ride" variant="secondary" onPress={comingSoon} />
        </>
      )}
    </Screen>
  );
}
