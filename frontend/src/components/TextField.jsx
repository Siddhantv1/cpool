import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useTheme } from "../constants/theme";

// label is shown as the placeholder and read by screen readers.
// secure = password field with a Show / Hide button.
// Extra props (value, onChangeText, keyboardType...) go straight to TextInput.
export default function TextField({ label, error, secure = false, ...inputProps }) {
  const { colors, spacing, fontSize, radius } = useTheme();
  const [hidden, setHidden] = useState(true);

  return (
    <View style={{ gap: spacing.xs }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1.5,
          borderColor: error ? colors.error : "transparent",
          paddingHorizontal: spacing.md,
        }}
      >
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
            <Text style={{ color: colors.primary, fontSize: fontSize.sm, fontWeight: "600" }}>{hidden ? "Show" : "Hide"}</Text>
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
