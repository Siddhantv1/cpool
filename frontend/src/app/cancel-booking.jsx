import { Ionicons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Screen from "../components/Screen";
import { useTheme } from "../constants/theme";
import { useTrips, withdrawBooking } from "../lib/trips";

const REASONS = ["My plans changed", "I found another ride", "Pickup point is too far", "Host asked me to cancel", "Something else"];

// Guest cancels an accepted ride: pick a reason so the host knows why.
export default function CancelBooking() {
  const { colors, spacing, fontSize, radius } = useTheme();
  const { booking } = useTrips();
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState("");
  if (!booking || booking.status !== "accepted") return <Redirect href="/home" />;
  const firstName = booking.host.name.split(" ")[0];
  const other = reason === "Something else";
  const ready = reason && (!other || note.trim().length >= 3);

  function confirm() {
    withdrawBooking(other ? note.trim() : reason);
    if (router.canDismiss()) router.dismissAll();
    router.push({ pathname: "/cancelled", params: { kind: "me" } });
  }

  return (
    <Screen
      back
      title="Cancel your ride?"
      subtitle={`${firstName} is keeping a seat for you tomorrow at ${booking.host.time} AM. Let them know why you can’t make it.`}
      footer={
        <>
          <Pressable
            onPress={confirm}
            disabled={!ready}
            accessibilityRole="button"
            accessibilityState={{ disabled: !ready }}
            style={{ backgroundColor: ready ? colors.danger : colors.disabled, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: "center" }}
          >
            <Text style={{ color: colors.onImage, fontWeight: "800", fontSize: fontSize.md }}>Cancel ride</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: "center" }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md }}>Keep my ride</Text>
          </Pressable>
        </>
      }
    >
      <View accessibilityRole="radiogroup" style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, overflow: "hidden" }}>
        {REASONS.map((r, i) => (
          <Pressable
            key={r}
            onPress={() => setReason(r)}
            accessibilityRole="radio"
            accessibilityState={{ checked: reason === r }}
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}
          >
            <Text style={{ flex: 1, color: colors.text, fontSize: fontSize.md, fontWeight: reason === r ? "700" : "500" }}>{r}</Text>
            <Ionicons name={reason === r ? "radio-button-on" : "radio-button-off"} size={22} color={reason === r ? colors.ink : colors.border} />
          </Pressable>
        ))}
      </View>
      {other ? (
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={`Tell ${firstName} what happened`}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Reason"
          multiline
          maxLength={140}
          style={{ minHeight: 88, textAlignVertical: "top", backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, color: colors.text, fontSize: fontSize.md }}
        />
      ) : null}
      <View style={{ flexDirection: "row", gap: spacing.sm, backgroundColor: colors.warningSurface, borderRadius: radius.lg, padding: spacing.md }}>
        <Ionicons name="information-circle-outline" size={19} color={colors.warning} />
        <Text style={{ flex: 1, color: colors.warning, fontSize: fontSize.sm, lineHeight: 19 }}>Cancelling often makes it harder to get seats. If you’re only running late, call {firstName} instead.</Text>
      </View>
    </Screen>
  );
}
