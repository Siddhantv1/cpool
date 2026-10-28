import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Button from "../../components/Button";
import Screen from "../../components/Screen";
import { useTheme } from "../../constants/theme";
import { getDraft, updateDraft } from "../../lib/onboarding";

const MIN = 1;
const MAX = 7; // guest seats, not counting the driver (design doc limit)

function RoundButton({ icon, label, onPress, disabled, filled }) {
  const { colors, radius, rs } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={{
        width: rs(52),
        height: rs(52),
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: filled ? colors.primary : colors.surface,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Ionicons name={icon} size={rs(24)} color={filled ? colors.onPrimary : colors.text} />
    </Pressable>
  );
}

// Car seen from above: the driver ("You") plus up to 7 guest seats, lit up up to `count`.
function SeatMap({ count }) {
  const { colors, spacing, radius, rs, rf } = useTheme();
  const seat = (lit, key) => (
    <View key={key} style={{ width: rs(30), height: rs(36), borderRadius: rs(9), backgroundColor: lit ? colors.primary : colors.secondary }} />
  );
  // Rows: [driver, front passenger], [3 middle], [3 back]; guest seat numbers fill front, then middle, then back.
  return (
    <View
      style={{ alignSelf: "center", width: rs(150), padding: spacing.md, paddingTop: spacing.lg, gap: spacing.md, borderRadius: rs(44), borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface }}
      accessible
      accessibilityLabel={`${count} of ${MAX} guest seats offered`}
    >
      <View style={{ height: rs(10), marginHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.primarySurface }} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.xs }}>
        <View style={{ alignItems: "center", gap: 2 }}>
          <View style={{ width: rs(30), height: rs(36), borderRadius: rs(9), backgroundColor: colors.text }} />
          <Text style={{ color: colors.textMuted, fontSize: rf(10) }}>You</Text>
        </View>
        {seat(count >= 1, "f")}
      </View>
      {[[2, 3, 4], [5, 6, 7]].map((row, r) => (
        <View key={r} style={{ flexDirection: "row", justifyContent: "space-between" }}>
          {row.map((n) => seat(count >= n, n))}
        </View>
      ))}
    </View>
  );
}

export default function Seats() {
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  const [seats, setSeats] = useState(getDraft().seats ?? 4);

  function onContinue() {
    updateDraft({ seats, helmet: null });
    router.push("/rc");
  }

  return (
    <Screen
      back
      step={2}
      title="How many guests can you take?"
      subtitle="Not counting you. You can change it for each ride."
      footer={<Button title="Continue" onPress={onContinue} />}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xl }}>
        <RoundButton icon="remove" label="One seat fewer" onPress={() => setSeats(seats - 1)} disabled={seats <= MIN} />
        <View style={{ alignItems: "center", minWidth: rs(64) }} accessibilityLiveRegion="polite">
          <Text style={{ color: colors.text, fontSize: rf(48), fontWeight: "900" }}>{seats}</Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{seats === 1 ? "guest seat" : "guest seats"}</Text>
        </View>
        <RoundButton icon="add" label="One seat more" onPress={() => setSeats(seats + 1)} disabled={seats >= MAX} filled />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: spacing.sm }}>
        {[2, 4, 6].map((n) => (
          <Pressable
            key={n}
            onPress={() => setSeats(n)}
            accessibilityRole="button"
            accessibilityLabel={`${n} seats`}
            accessibilityState={{ selected: seats === n }}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs + 2,
              borderRadius: radius.pill,
              backgroundColor: seats === n ? colors.primarySurface : colors.surface,
            }}
          >
            <Text style={{ color: seats === n ? colors.primary : colors.textMuted, fontSize: fontSize.sm, fontWeight: "700" }}>{n}</Text>
          </Pressable>
        ))}
      </View>
      <SeatMap count={seats} />
    </Screen>
  );
}
