import { Pressable, Text, View } from "react-native";
import { useTheme } from "../constants/theme";

// A tappable choice with an icon, a title, a short description and a radio circle.
export default function OptionCard({ icon, title, description, selected, onPress }) {
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}. ${description}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.lg + 2,
        borderWidth: 2,
        borderColor: selected ? colors.primary : "transparent",
        backgroundColor: selected ? colors.primarySurface : colors.surface,
      }}
    >
      <View style={{ width: rs(44), height: rs(44), borderRadius: radius.md + 2, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        {icon}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: "700" }}>{title}</Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, lineHeight: rf(18) }}>{description}</Text>
      </View>
      <View
        style={{
          width: rs(22),
          height: rs(22),
          borderRadius: radius.pill,
          borderWidth: 2,
          borderColor: selected ? colors.primary : colors.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected ? <View style={{ width: rs(11), height: rs(11), borderRadius: radius.pill, backgroundColor: colors.primary }} /> : null}
      </View>
    </Pressable>
  );
}
