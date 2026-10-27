import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../constants/theme";

// Coloured header with a tilted stamp ("ACCEPTED" / "CANCELLED"), like a rubber stamp on a ticket.
export default function StatusHeader({ tone, stamp, title, subtitle }) {
  const { colors, spacing, fontSize } = useTheme();
  const insets = useSafeAreaInsets();
  const bg = tone === "danger" ? colors.danger : colors.green;
  const ink = tone === "danger" ? colors.danger : colors.green;

  return (
    <View style={{ backgroundColor: bg, paddingTop: insets.top + spacing.sm, paddingBottom: spacing.xl + spacing.md, alignItems: "center", gap: spacing.sm }}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/home"))}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={{ position: "absolute", left: spacing.md, top: insets.top + spacing.sm, width: 38, height: 38, borderRadius: 19, backgroundColor: colors.onImage, alignItems: "center", justifyContent: "center" }}
      >
        <Ionicons name="chevron-back" size={20} color={colors.onImageInk} />
      </Pressable>
      <View
        accessible
        accessibilityLabel={stamp}
        style={{ marginTop: spacing.lg, width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: colors.onImage, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-12deg" }] }}
      >
        <View style={{ position: "absolute", top: 7, left: 7, right: 7, bottom: 7, borderRadius: 53, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.onImage }} />
        <Text style={{ color: colors.onImage, fontSize: 10, position: "absolute", top: 14 }}>★ ★ ★</Text>
        <View style={{ backgroundColor: colors.onImage, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, maxWidth: 132 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} allowFontScaling={false} style={{ color: ink, fontWeight: "900", fontSize: 13, letterSpacing: 1 }}>{stamp}</Text>
        </View>
        <Text style={{ color: colors.onImage, fontSize: 10, position: "absolute", bottom: 14 }}>★ ★ ★</Text>
      </View>
      <Text accessibilityRole="header" style={{ color: colors.onImage, fontSize: fontSize.xl - 6, fontWeight: "800", marginTop: spacing.sm }}>{title}</Text>
      <Text style={{ color: colors.onImage, opacity: 0.9, fontSize: fontSize.md }}>{subtitle}</Text>
    </View>
  );
}
