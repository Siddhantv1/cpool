import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../constants/theme";

// Looks like a text field; tapping it opens a bottom sheet with a list to pick from.
// options = [{ label, value }]
export default function PickerField({ label, value, options, onChange }) {
  const { colors, spacing, fontSize, radius, rs } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={selected ? `${label}: ${selected.label}` : `Choose ${label}`}
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md + 2,
        }}
      >
        <Text style={{ color: selected ? colors.text : colors.textMuted, fontSize: fontSize.md }}>{selected ? selected.label : label}</Text>
        <Ionicons name="chevron-down" size={rs(18)} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: colors.scrim }} onPress={() => setOpen(false)} accessibilityLabel="Close" />
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: radius.lg + 8,
            borderTopRightRadius: radius.lg + 8,
            paddingTop: spacing.sm,
            paddingBottom: insets.bottom + spacing.md,
            maxHeight: "60%",
          }}
        >
          <View style={{ alignSelf: "center", width: rs(40), height: rs(4), borderRadius: radius.pill, backgroundColor: colors.border, marginBottom: spacing.sm }} />
          <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: "800", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
            {label}
          </Text>
          <ScrollView>
            {options.map((o) => (
              <Pressable
                key={o.value}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: o.value === value }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  backgroundColor: pressed ? colors.surface : "transparent",
                })}
              >
                <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: o.value === value ? "700" : "400" }}>{o.label}</Text>
                {o.value === value ? <Ionicons name="checkmark" size={rs(20)} color={colors.primary} /> : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
