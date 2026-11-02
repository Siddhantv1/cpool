import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useTheme } from "../constants/theme";

// label is shown as the placeholder and read by screen readers.
// secure = password field with an eye button to show / hide it. prefix = fixed text before the input (e.g. "+91").
// onCard = the field sits on a grey card, so the box is white instead of grey.
// Extra props (value, onChangeText, keyboardType...) go straight to TextInput.
export default function TextField({ label, error, secure = false, prefix, onCard = false, ...inputProps }) {
  const { colors, spacing, fontSize, radius } = useTheme();
  const [hidden, setHidden] = useState(true);

  return (
    <View style={{ gap: spacing.xs }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: onCard ? colors.background : colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1.5,
          borderColor: error ? colors.error : onCard ? colors.line : "transparent",
          paddingHorizontal: spacing.md,
        }}
      >
        {prefix ? <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: "700", marginRight: spacing.sm }}>{prefix}</Text> : null}
        {prefix ? <View style={{ width: 1, height: fontSize.md * 1.4, backgroundColor: colors.border, marginRight: spacing.sm }} /> : null}
        <TextInput
          accessibilityLabel={label}
          placeholder={label}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secure && hidden}
          style={{ flex: 1, color: colors.text, fontSize: fontSize.md, paddingVertical: spacing.md + 2 }}
          {...inputProps}
        />
        {secure ? (
          <Pressable
            onPress={() => setHidden(!hidden)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? `Show ${label}` : `Hide ${label}`}
            hitSlop={8}
          >
            <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={fontSize.md * 1.35} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={{ color: colors.error, fontSize: fontSize.sm }} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
