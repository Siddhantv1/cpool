import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "../../components/RideUI";
import { useTheme } from "../../constants/theme";
import { PAST_RIDES } from "../../lib/mock";
import { cancelBooking, useTrips } from "../../lib/trips";

export default function MyRides() {
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  const { booking, passengers, published } = useTrips();
  const upcoming = booking?.status === "accepted";
  const waiting = booking?.status === "requested";

  const card = (children, onPress) => (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg + 2, padding: spacing.md, gap: spacing.sm }}>
      {children}
    </Pressable>
  );

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: fontSize.xl - 4, fontWeight: "800" }}>My rides</Text>

        <Text style={{ color: colors.textMuted, fontSize: rf(11), fontWeight: "800", letterSpacing: 1 }}>UPCOMING</Text>
        {!upcoming && !waiting && !passengers.length && !published ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: rs(4) }}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>No upcoming rides</Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Find a ride or offer one from Home.</Text>
          </View>
        ) : null}
        {waiting
          ? card(
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <Avatar initials={booking.host.initials} color={booking.host.color} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.warning, fontWeight: "700" }}>Waiting for {booking.host.name.split(" ")[0]} to accept</Text>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Tomorrow · {booking.host.time} AM · {booking.pickup.name} → {booking.drop.short ?? booking.drop.name}</Text>
                </View>
                <Ionicons name="chevron-forward" size={rs(18)} color={colors.textMuted} />
              </View>,
              () => router.push("/requested"),
            )
          : null}
        {upcoming
          ? card(
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <Avatar initials={booking.host.initials} color={booking.host.color} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Tomorrow · {booking.host.time} AM</Text>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>With {booking.host.name} · {booking.pickup.name} → {booking.drop.short ?? booking.drop.name}</Text>
                </View>
                <Ionicons name="chevron-forward" size={rs(18)} color={colors.textMuted} />
              </View>,
              () => router.push("/accepted"),
            )
          : null}
        {published
          ? card(
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <MaterialCommunityIcons name="steering" size={rs(26)} color={colors.green} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>You’re hosting · {published.when}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{passengers.length ? `With ${passengers.map((p) => p.name.split(" ")[0]).join(", ")}` : "Waiting for requests"}</Text>
                </View>
                <Ionicons name="chevron-forward" size={rs(18)} color={colors.textMuted} />
              </View>,
              () => router.push(passengers.length ? "/drive" : "/home"),
            )
          : null}

        <Text style={{ color: colors.textMuted, fontSize: rf(11), fontWeight: "800", letterSpacing: 1, marginTop: spacing.sm }}>PAST</Text>
        {PAST_RIDES.map((r) => (
          <View key={r.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <View style={{ width: rs(38), height: rs(38), borderRadius: rs(19), backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
              <MaterialCommunityIcons name={r.role === "host" ? "steering" : "seat-passenger"} size={rs(18)} color={colors.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>{r.from} → {r.to}</Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{r.when} · {r.role === "host" ? "Hosted" : "With"} {r.with}</Text>
            </View>
          </View>
        ))}

        {__DEV__ && upcoming ? (
          // Development only: shows the "ride cancelled" screen without a backend.
          <Pressable
            onPress={() => {
              cancelBooking();
              router.push("/cancelled");
            }}
            accessibilityRole="button"
            style={{ marginTop: spacing.lg, borderWidth: 1, borderStyle: "dashed", borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm + 4, alignItems: "center" }}
          >
            <Text style={{ color: colors.textMuted, fontWeight: "600" }}>Demo: host cancels my ride</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
