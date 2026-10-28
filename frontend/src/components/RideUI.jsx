import { Ionicons } from "@expo/vector-icons";
import { Alert, Linking, Pressable, Share, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../constants/theme";

// Pieces shared by the ride screens: avatar, number plate, SOS, ETA card, bottom sheet, stops.

export function Avatar({ initials, color, size = 40 }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: colors.onImage, fontWeight: "800", fontSize: size * 0.34 }}>{initials}</Text>
    </View>
  );
}

export function Plate({ text }) {
  const { colors, rs, rf } = useTheme();
  return (
    <View style={{ backgroundColor: colors.onImage, borderWidth: 2, borderColor: colors.onImageInk, borderRadius: rs(7), paddingHorizontal: rs(7), paddingVertical: rs(3) }}>
      <Text style={{ color: colors.onImageInk, fontWeight: "800", fontSize: rf(12), letterSpacing: 0.8 }}>{text}</Text>
    </View>
  );
}

export const call = (phone) => Linking.openURL(`tel:${phone}`).catch(() => Alert.alert("Can't open the dialer", phone));

export function shareTrip(text) {
  Share.share({ message: text }).catch(() => {});
}

export function confirmSos() {
  Alert.alert("Send SOS?", "The security desk and your emergency contacts will get your live location.", [
    { text: "Cancel", style: "cancel" },
    { text: "Call 112", style: "destructive", onPress: () => Linking.openURL("tel:112") },
    // shortcut: alerting the security desk needs POST /v1/rides/{id}/sos on the backend.
    { text: "Alert security", onPress: () => Alert.alert("SOS sent", "The security desk has been alerted.") },
  ]);
}

export function RoundButton({ icon, label, onPress, color, background }) {
  const { colors, radius, rs } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: rs(46), height: rs(46), borderRadius: radius.pill, backgroundColor: background ?? colors.background, alignItems: "center", justifyContent: "center", elevation: 4, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}
    >
      {typeof icon === "string" ? <Ionicons name={icon} size={rs(20)} color={color ?? colors.text} /> : icon}
    </Pressable>
  );
}

export function SosButton() {
  const { colors, rf } = useTheme();
  return (
    <RoundButton
      label="SOS"
      onPress={confirmSos}
      background={colors.danger}
      icon={<Text style={{ color: colors.onImage, fontWeight: "900", fontSize: rf(12) }}>SOS</Text>}
    />
  );
}

export function EtaCard({ big, unit = "min", title, subtitle, live = true }) {
  const { colors, spacing, fontSize, radius, rf } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.background, borderRadius: radius.lg + 4, padding: spacing.md, elevation: 6, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10 }}>
      <Text style={{ color: colors.text, fontSize: rf(30), fontWeight: "800" }}>
        {big}
        <Text style={{ fontSize: fontSize.sm, color: colors.textMuted }}> {unit}</Text>
      </Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: "700" }} numberOfLines={1}>{title}</Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }} numberOfLines={1}>{subtitle}</Text>
      </View>
      {live ? <Text style={{ color: colors.danger, fontSize: rf(11), fontWeight: "800", letterSpacing: 1 }}>● LIVE</Text> : null}
    </View>
  );
}

// Bottom sheet that sits over the map.
export function MapSheet({ children }) {
  const { colors, spacing, radius, rs } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: colors.background, borderTopLeftRadius: radius.lg + 10, borderTopRightRadius: radius.lg + 10, padding: spacing.md, paddingBottom: insets.bottom + spacing.md, gap: spacing.md, elevation: 12, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 16 }}>
      <View style={{ alignSelf: "center", width: rs(40), height: rs(4), borderRadius: rs(4), backgroundColor: colors.line }} />
      {children}
    </View>
  );
}

// Pickup → drop timeline. stops = [{ title, subtitle, time, done }]
export function Stops({ stops }) {
  const { colors, spacing, fontSize, rs } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      {stops.map((s, i) => (
        <View key={s.title} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          {s.done ? (
            <View style={{ width: rs(20), height: rs(20), borderRadius: rs(10), backgroundColor: colors.green, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="checkmark" size={rs(13)} color={colors.onGreen} />
            </View>
          ) : (
            <View style={{ width: rs(20), alignItems: "center" }}>
              <View style={{ width: rs(12), height: rs(12), borderRadius: i === stops.length - 1 ? 3 : 6, borderWidth: 2.5, borderColor: colors.text, backgroundColor: i === stops.length - 1 ? colors.text : "transparent" }} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: "700" }}>{s.title}</Text>
            {s.subtitle ? <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{s.subtitle}</Text> : null}
          </View>
          <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: "800" }}>{s.time}</Text>
        </View>
      ))}
    </View>
  );
}

// Two buttons side by side: a light one and a strong one.
export function ActionRow({ left, right }) {
  const { colors, spacing, fontSize, radius, rs } = useTheme();
  const btn = (b, strong) => (
    <Pressable
      key={b.title}
      onPress={b.onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flex: strong && b.wide ? 2 : 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs + 2,
        paddingVertical: spacing.md - 2,
        borderRadius: radius.lg,
        backgroundColor: strong ? (b.green ? colors.green : colors.ink) : colors.surface,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {b.icon ? <Ionicons name={b.icon} size={rs(17)} color={strong ? (b.green ? colors.onGreen : colors.onInk) : colors.text} /> : null}
      <Text style={{ color: strong ? (b.green ? colors.onGreen : colors.onInk) : colors.text, fontWeight: "800", fontSize: fontSize.md }}>{b.title}</Text>
    </Pressable>
  );
  return <View style={{ flexDirection: "row", gap: spacing.sm }}>{[btn(left, false), btn(right, true)]}</View>;
}
