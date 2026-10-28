import { Ionicons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ActionRow, Avatar, call, Plate, Stops } from "../components/RideUI";
import StatusHeader from "../components/StatusHeader";
import { useTheme } from "../constants/theme";
import { clockPlus, useRoute } from "../lib/directions";
import { useTrips } from "../lib/trips";

export default function Accepted() {
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  const insets = useSafeAreaInsets();
  const { booking } = useTrips();
  const ride = useRoute(booking ? [booking.pickup.coords, booking.drop.coords] : null);
  if (!booking) return <Redirect href="/home" />;
  // Cancelling moves on to the Cancelled screen; render nothing meanwhile instead of also redirecting.
  if (booking.status !== "accepted") return null;
  const h = booking.host;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <StatusHeader tone="success" stamp="ACCEPTED" title={`You're riding with ${h.name.split(" ")[0]}`} subtitle={`Tomorrow · pickup ${h.time} AM`} />
        <View style={{ flex: 1, marginTop: -rs(24), backgroundColor: colors.background, borderTopLeftRadius: rs(24), borderTopRightRadius: rs(24), padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg, gap: spacing.lg }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <Avatar initials={h.initials} color={h.color} size={rs(46)} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md + 1 }}>{h.name}</Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{h.vehicle}</Text>
            </View>
            <Plate text={h.plate} />
          </View>
          <Text style={{ color: colors.textMuted, fontSize: rf(11), fontWeight: "800", letterSpacing: 1 }}>YOUR TRIP</Text>
          <Stops
            stops={[
              { title: booking.pickup.name, subtitle: "Pickup", time: h.time },
              { title: booking.drop.name, subtitle: ride ? `Drop · ${ride.km.toFixed(1)} km ride` : "Drop", time: ride ? clockPlus(h.time, ride.minutes) : "" },
            ]}
          />
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, backgroundColor: colors.greenSurface, borderRadius: radius.lg, padding: spacing.md }}>
            <Ionicons name="alarm-outline" size={rs(19)} color={colors.green} />
            <Text style={{ color: colors.green, fontWeight: "600", flex: 1 }}>We’ll remind you 15 minutes before pickup.</Text>
          </View>
          <View style={{ flex: 1 }} />
          <ActionRow left={{ title: "Call", icon: "call-outline", onPress: () => call(h.phone) }} right={{ title: "Track ride", green: true, wide: true, onPress: () => router.push("/coming") }} />
          <Pressable onPress={() => router.push("/cancel-booking")} accessibilityRole="button" style={{ alignItems: "center", padding: spacing.sm }}>
            <Text style={{ color: colors.textMuted, fontWeight: "700" }}>Cancel ride</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
