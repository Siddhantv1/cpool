import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Keyboard, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../constants/theme";

// Height of the on-screen keyboard (0 when closed).
// The app draws edge-to-edge, so the keyboard covers the screen instead of resizing it; we lift the footer ourselves.
function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

// back   = show the back arrow (goes back, or to Welcome if there is nothing to go back to)
// step   = show a progress bar "Step 2 of 3" next to the back arrow
// title / subtitle = big heading at the top
// footer = buttons pinned to the bottom, kept above the keyboard
export default function Screen({ children, back = false, step, steps = 3, title, subtitle, footer }) {
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/welcome"));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* SafeAreaView already pads the bottom inset, so don't count it twice. */}
      <View style={{ flex: 1, paddingBottom: Math.max(0, keyboard - insets.bottom) }}>
        {back || step ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
            {back ? (
              <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12}>
                <Text style={{ color: colors.primary, fontSize: fontSize.xl }}>←</Text>
              </Pressable>
            ) : null}
            {step ? (
              <View
                style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm }}
                accessible
                accessibilityLabel={`Step ${step} of ${steps}`}
              >
                <View style={{ flex: 1, flexDirection: "row", gap: spacing.xs }}>
                  {Array.from({ length: steps }, (_, i) => (
                    <View key={i} style={{ flex: 1, height: rs(4), borderRadius: radius.pill, backgroundColor: i < step ? colors.primary : colors.secondary }} />
                  ))}
                </View>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
                  Step {step} of {steps}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, gap: spacing.md }}
          keyboardShouldPersistTaps="handled"
        >
          {title ? (
            <Text accessibilityRole="header" style={{ color: colors.text, fontSize: fontSize.xxl, fontWeight: "800" }}>
              {title}
            </Text>
          ) : null}
          {subtitle ? <Text style={{ color: colors.textMuted, fontSize: fontSize.md, lineHeight: rf(22) }}>{subtitle}</Text> : null}
          {children}
        </ScrollView>
        {footer ? <View style={{ padding: spacing.lg, gap: spacing.sm }}>{footer}</View> : null}
      </View>
    </SafeAreaView>
  );
}
