import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar, Stops } from "../components/RideUI";
import StatusHeader from "../components/StatusHeader";
import { useTheme } from "../constants/theme";
import { playAlert } from "../lib/alerts";
import { HOSTS } from "../lib/mock";
import { clearBooking, getTrips } from "../lib/trips";

// kind: "host" = the host cancelled, "declined" = the host said no to your request, "me" = you cancelled.
const COPY = {
  host: { stamp: "CANCELLED", title: "Ride cancelled", note: (name, reason) => [`${name} cancelled this ride`, `Reason: ${reason ?? "plans changed"}. Your other requests for this trip are still open.`] },
  declined: { stamp: "DECLINED", title: "Request declined", note: (name) => [`${name} can’t take you this time`, "It’s usually a full car or a change of route. Try one of these rides instead."] },
  me: { stamp: "CANCELLED", title: "You cancelled", note: (name, reason) => [`${name} has been told`, `Your reason: ${reason ?? "plans changed"}. The seat is free for someone else now.`] },
};

export default function Cancelled() {
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  const insets = useSafeAreaInsets();
  const { kind = "host" } = useLocalSearchParams();
  const copy = COPY[kind] ?? COPY.host;
  const booking = getTrips().booking;
  const host = booking?.host ?? HOSTS[0];
  const others = HOSTS.filter((h) => h.id !== host.id && h.seatsFree > 0); // full rides aren't offered
  const [noteTitle, noteText] = copy.note(host.name.split(" ")[0], booking?.reason);

  useEffect(() => {
    // The decline sound already played on the screen that showed it; you don't need a sound for your own cancel.
    if (kind === "host") playAlert("cancelled");
    return () => clearBooking();
  }, [kind]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <StatusHeader tone="danger" stamp={copy.stamp} title={copy.title} subtitle={`Tomorrow · ${host.time} AM with ${host.name}`} />
        <View style={{ flex: 1, marginTop: -rs(24), backgroundColor: colors.background, borderTopLeftRadius: rs(24), borderTopRightRadius: rs(24), padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg, gap: spacing.lg }}>
          <Text style={{ color: colors.textMuted, fontSize: rf(11), fontWeight: "800", letterSpacing: 1 }}>RIDE DETAILS</Text>
          <Stops
            stops={[
              { title: booking?.pickup?.name ?? "Pickup", subtitle: "Pickup", time: host.time },
              { title: booking?.drop?.name ?? "Office", subtitle: "Drop", time: "" },
            ]}
          />
          <View style={{ flexDirection: "row", gap: spacing.sm + 2, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md }}>
            <Ionicons name="alert-circle-outline" size={rs(20)} color={colors.danger} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>{noteTitle}</Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, lineHeight: rf(19) }}>{noteText}</Text>
            </View>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: rf(11), fontWeight: "800", letterSpacing: 1 }}>OTHER RIDES FOR YOU</Text>
          {others.map((h) => (
            <View key={h.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.sm + 4 }}>
              <Avatar initials={h.initials} color={h.color} size={rs(34)} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: rs(4) }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>{h.name}</Text>
                  <MaterialCommunityIcons name={h.type === "bike" ? "motorbike" : "car"} size={rs(15)} color={colors.primary} />
                </View>
                <Text style={{ color: colors.textMuted, fontSize: rf(12) }}>{h.walkTo} walk · {h.seatsFree} seat{h.seatsFree > 1 ? "s" : ""}</Text>
              </View>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md }}>{h.time}</Text>
            </View>
          ))}
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => router.replace("/results")} accessibilityRole="button" style={{ backgroundColor: colors.ink, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: "center" }}>
            <Text style={{ color: colors.onInk, fontWeight: "800", fontSize: fontSize.md }}>Find another ride</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
