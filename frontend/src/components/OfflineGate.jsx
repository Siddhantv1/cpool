import { Ionicons } from "@expo/vector-icons";
import NetInfo, { useNetInfo } from "@react-native-community/netinfo";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../constants/theme";
import { useTrips } from "../lib/trips";

// Covers the app with a clear "No internet" screen while the phone is offline.
export default function OfflineGate() {
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  const insets = useSafeAreaInsets();
  const net = useNetInfo();
  const { booking } = useTrips();
  if (net.isConnected !== false) return null;
  const h = booking?.status === "accepted" ? booking.host : null;

  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.background }} accessibilityViewIsModal>
      <View style={{ paddingTop: insets.top + spacing.xs, paddingBottom: spacing.xs, backgroundColor: colors.ink, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: rs(6) }}>
        <Ionicons name="cloud-offline-outline" size={rs(14)} color={colors.onInk} />
        <Text style={{ color: colors.onInk, fontSize: rf(12), fontWeight: "600" }}>You’re offline</Text>
      </View>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md }}>
        <View style={{ width: rs(116), height: rs(116), borderRadius: rs(58), backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm }}>
          <Ionicons name="cloud-offline-outline" size={rs(56)} color={colors.textMuted} />
        </View>
        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: fontSize.lg + 2, fontWeight: "800" }}>No internet connection</Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.md, textAlign: "center", lineHeight: rf(22) }}>
          Check your Wi-Fi or mobile data. Your rides are safe; we’ll update everything when you’re back online.
        </Text>
        {h ? (
          <View style={{ alignSelf: "stretch", borderWidth: 1, borderStyle: "dashed", borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: rs(4) }}>
            <Text style={{ color: colors.textMuted, fontSize: rf(11), fontWeight: "700" }}>Last saved · your next ride</Text>
            <Text style={{ color: colors.text, fontWeight: "700" }}>{h.name} · Tomorrow {h.time} AM</Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{booking.pickup.name} → {booking.drop.name} · {h.plate}</Text>
          </View>
        ) : null}
        <Pressable onPress={() => NetInfo.refresh()} accessibilityRole="button" style={{ alignSelf: "stretch", backgroundColor: colors.ink, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.sm }}>
          <Text style={{ color: colors.onInk, fontWeight: "800", fontSize: fontSize.md }}>Try again</Text>
        </Pressable>
      </View>
    </View>
  );
}
