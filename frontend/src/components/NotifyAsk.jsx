import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../constants/theme";
import { requestNotificationPermission, useNotificationAsk } from "../lib/notify";

// Bottom sheet asking to turn on notifications (or the host island), with a preview of what you'd get. Android then
// asks "Allow?" (or opens its own switch, for the island).
export default function NotifyAsk() {
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  const insets = useSafeAreaInsets();
  const [copy, close] = useNotificationAsk();
  if (!copy) return null;

  async function turnOn() {
    close();
    if (copy.onAllow) copy.onAllow();
    else await requestNotificationPermission();
  }
  const button = (title, onPress, strong) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} style={{ backgroundColor: strong ? colors.primary : colors.surface, borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: "center" }}>
      <Text style={{ color: strong ? colors.onPrimary : colors.text, fontWeight: "800", fontSize: fontSize.md }}>{title}</Text>
    </Pressable>
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <Pressable style={{ flex: 1, backgroundColor: colors.scrim }} onPress={close} accessibilityLabel="Close" />
      <View style={{ backgroundColor: colors.background, borderTopLeftRadius: rs(26), borderTopRightRadius: rs(26), padding: spacing.lg, paddingTop: spacing.md, paddingBottom: insets.bottom + spacing.lg, gap: spacing.md }}>
        <View style={{ alignSelf: "center", width: rs(40), height: rs(4), borderRadius: rs(4), backgroundColor: colors.line }} />
        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: rf(21), fontWeight: "800", textAlign: "center" }}>{copy.title}</Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.md, textAlign: "center", marginTop: -spacing.xs }}>{copy.text}</Text>
        {copy.pill ? (
          // The host island as it floats over Maps (approved demo): dark pill, blue car badge, progress ring, text.
          <View accessible accessibilityLabel={`Example: ${copy.pill}`} style={{ alignItems: "center", backgroundColor: "#E8EAE6", borderRadius: radius.lg, padding: spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: rs(8), height: rs(40), paddingLeft: rs(6), paddingRight: rs(14), borderRadius: rs(20), backgroundColor: "#0B1020" }}>
              <View style={{ width: rs(28), height: rs(28), borderRadius: rs(14), backgroundColor: "#1D4ED8", alignItems: "center", justifyContent: "center" }}>
                <MaterialCommunityIcons name="car" size={rs(16)} color="#FFFFFF" />
              </View>
              <View style={{ width: rs(22), height: rs(22), borderRadius: rs(11), borderWidth: rs(4), borderColor: "rgba(255,255,255,0.18)", borderTopColor: "#0F9D63", transform: [{ rotate: "45deg" }] }} />
              <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: rf(13.5) }}>{copy.pill}</Text>
            </View>
          </View>
        ) : (
          <View accessible accessibilityLabel={`Example: ${copy.preview[0]}. ${copy.preview[1]}`} style={{ flexDirection: "row", gap: spacing.sm + 2, alignItems: "center", borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.md }}>
            <View style={{ width: rs(30), height: rs(30), borderRadius: rs(9), backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: colors.onPrimary, fontWeight: "900" }}>C</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>{copy.preview[0]}</Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{copy.preview[1]}</Text>
            </View>
          </View>
        )}
        {button(copy.button ?? "Turn on notifications", turnOn, true)}
        {button("Not now", close)}
      </View>
    </Modal>
  );
}
