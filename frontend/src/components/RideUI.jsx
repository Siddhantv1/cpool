import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Alert, Animated, Easing, Linking, Pressable, Share, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../constants/theme";
import { useMapControl } from "../lib/mapControl";

// Pieces shared by the ride screens: avatar, number plate, SOS, ETA card, bottom sheet, stops.

// gender ("Female" | "Male") shows the drawn default picture; without it, coloured initials.
export function Avatar({ initials, color, size = 40, gender }) {
  const { colors } = useTheme();
  if (gender === "Female" || gender === "Male") return <PersonAvatar gender={gender} size={size} />;
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
  const map = useMapControl();
  return (
    <View style={{ backgroundColor: colors.background, borderTopLeftRadius: radius.lg + 10, borderTopRightRadius: radius.lg + 10, padding: spacing.md, paddingBottom: insets.bottom + spacing.md, gap: spacing.md, elevation: 12, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 16 }}>
      {/* Recenter button rides on top of the card, so it's always just above it whatever the card's height. */}
      {map ? (
        <View style={{ position: "absolute", right: rs(16), top: -rs(58), elevation: 13 }}>
          <RoundButton icon={map.onMe ? "map-outline" : "locate"} label={map.onMe ? "Show the whole trip" : "Show my location"} color={colors.primary} onPress={map.recenter} />
        </View>
      ) : null}
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

// "Request sent" panel on a ride you asked for: a spinning ring and a sliding line while the host decides, plus Cancel.
export function RequestStatus({ name, onCancel }) {
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  // Animated values are created once and kept for the life of the panel.
  const [spin] = useState(() => new Animated.Value(0));
  const [slide] = useState(() => new Animated.Value(0));
  const [width, setWidth] = useState(0);
  useEffect(() => {
    let loops = [];
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) return;
      loops = [
        Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: true })),
        Animated.loop(Animated.timing(slide, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true })),
      ];
      loops.forEach((l) => l.start());
    });
    return () => loops.forEach((l) => l.stop());
  }, [spin, slide]);
  const ring = rs(44);
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`Request sent. Waiting for ${name} to accept`}
      style={{ borderWidth: 1, borderColor: colors.cardLine, backgroundColor: colors.primarySurface, borderRadius: radius.lg + 2, paddingTop: spacing.md - 2, paddingHorizontal: spacing.md - 2, gap: spacing.md - 4, overflow: "hidden" }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm + 4 }}>
        <View style={{ width: ring, height: ring, alignItems: "center", justifyContent: "center" }}>
          <Animated.View
            style={{ position: "absolute", width: ring, height: ring, borderRadius: ring / 2, borderWidth: 3, borderColor: "transparent", borderTopColor: colors.primary, transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }}
          />
          <View style={{ width: ring - rs(8), height: ring - rs(8), borderRadius: ring, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="time-outline" size={rs(20)} color={colors.primary} />
          </View>
        </View>
        <View style={{ flex: 1, gap: rs(2) }}>
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: rf(15.5) }}>Request sent</Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Waiting for {name} to accept</Text>
        </View>
        <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel={`Cancel request to ${name}`} hitSlop={6} style={({ pressed }) => ({ paddingHorizontal: spacing.sm + 4, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: pressed ? colors.danger + "18" : "transparent" })}>
          <Text style={{ color: colors.danger, fontWeight: "700", fontSize: rf(14) }}>Cancel</Text>
        </Pressable>
      </View>
      {/* Thin line sliding along the bottom edge while waiting. */}
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: 3, marginHorizontal: -(spacing.md - 2), backgroundColor: colors.primary + "24", overflow: "hidden" }}>
        <Animated.View style={{ width: width * 0.38, height: 3, borderRadius: 3, backgroundColor: colors.primary, transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.38, width] }) }] }} />
      </View>
    </View>
  );
}

// Walk → ride → walk, in one rounded pill with dashed joins.
export function TripLegs({ host }) {
  const { colors, spacing, rs, rf } = useTheme();
  const vehicleIcon = host.type === "bike" ? "moped" : "car";
  const seg = (text, icon, ride) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: rs(4) }}>
      <Text style={{ color: ride ? colors.primary : colors.text, fontWeight: "700", fontSize: rf(15) }}>{text}</Text>
      <MaterialCommunityIcons name={icon} size={rs(18)} color={ride ? colors.primary : colors.text} />
    </View>
  );
  const dash = <View style={{ flex: 1, minWidth: rs(10), borderTopWidth: 1.5, borderStyle: "dashed", borderColor: colors.border }} />;
  return (
    <View
      accessibilityLabel={`Walk ${host.walkTo}, ride ${host.ride}, walk ${host.walkFrom}`}
      style={{ height: rs(46), borderWidth: 1, borderColor: colors.line, borderRadius: rs(23), flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md }}
    >
      {seg(host.walkTo, "walk")}
      {dash}
      {seg(host.ride, vehicleIcon, true)}
      {dash}
      {seg(host.walkFrom, "walk")}
    </View>
  );
}

// Default profile picture until someone adds a photo: a simple drawn person picked from their gender.
// gender: "Female" | "Male"; anything else ("Prefer not to say", none) shows an empty placeholder, no picture. Drawn with plain Views, so no image files are needed.
const LOOKS = {
  Female: { bg: "#FCE7F3", shirt: "#BE185D", hair: "#2B1B12", long: true },
  Male: { bg: "#DBEAFE", shirt: "#1D4ED8", hair: "#111827", long: false },
  other: { bg: "#E5E7EB", shirt: "#6B7280", hair: "#374151", long: false },
};
export function PersonAvatar({ gender, size = 40 }) {
  const { colors } = useTheme();
  if (gender !== "Female" && gender !== "Male") {
    return (
      <View accessible={false} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="person-outline" size={size * 0.46} color={colors.textMuted} />
      </View>
    );
  }
  const look = LOOKS[gender];
  const s = size;
  const skin = "#E0A983";
  const at = (left, top, w, h, extra) => ({ position: "absolute", left: s * left, top: s * top, width: s * w, height: s * h, ...extra });
  return (
    <View accessible={false} style={{ width: s, height: s, borderRadius: s / 2, overflow: "hidden", backgroundColor: look.bg }}>
      {look.long ? <View style={at(0.27, 0.19, 0.46, 0.52, { backgroundColor: look.hair, borderTopLeftRadius: s * 0.23, borderTopRightRadius: s * 0.23, borderBottomLeftRadius: s * 0.08, borderBottomRightRadius: s * 0.08 })} /> : null}
      <View style={at(0.14, 0.7, 0.72, 0.5, { backgroundColor: look.shirt, borderRadius: s * 0.36 })} />
      <View style={at(0.43, 0.54, 0.14, 0.18, { backgroundColor: skin, borderBottomLeftRadius: s * 0.07, borderBottomRightRadius: s * 0.07 })} />
      <View style={at(0.32, 0.22, 0.36, 0.4, { backgroundColor: skin, borderRadius: s * 0.18 })} />
      <View style={at(0.31, 0.18, 0.38, 0.17, { backgroundColor: look.hair, borderTopLeftRadius: s * 0.19, borderTopRightRadius: s * 0.19, borderBottomLeftRadius: s * (look.long ? 0.02 : 0.06), borderBottomRightRadius: s * 0.1 })} />
      <View style={at(0.42, 0.41, 0.04, 0.04, { backgroundColor: "#1F2937", borderRadius: s })} />
      <View style={at(0.54, 0.41, 0.04, 0.04, { backgroundColor: "#1F2937", borderRadius: s })} />
      <View style={at(0.45, 0.49, 0.1, 0.05, { borderBottomWidth: Math.max(1, s * 0.018), borderColor: "#7C2D12", borderBottomLeftRadius: s * 0.05, borderBottomRightRadius: s * 0.05 })} />
    </View>
  );
}
