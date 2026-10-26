import { ActivityIndicator, Pressable, Text } from "react-native";
import { useTheme } from "../constants/theme";

// variant: "primary" (filled), "secondary" (soft), "link" (text only, for "Forgot password?" etc.)
export default function Button({ title, onPress, variant = "primary", loading = false, disabled = false }) {
  const { colors, spacing, fontSize, radius } = useTheme();
  const inactive = disabled || loading;
  const isLink = variant === "link";
  const background = isLink ? "transparent" : disabled ? colors.disabled : variant === "primary" ? colors.primary : colors.secondary;
  const textColor = isLink ? colors.primary : variant === "primary" ? colors.onPrimary : colors.onSecondary;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      hitSlop={isLink ? 8 : 0}
      style={({ pressed }) => ({
        backgroundColor: background,
        paddingVertical: isLink ? spacing.xs : spacing.md,
        borderRadius: radius.pill,
        alignItems: "center",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={{ color: textColor, fontSize: fontSize.md, fontWeight: isLink ? "600" : "700" }}>{title}</Text>
      )}
    </Pressable>
  );
}
