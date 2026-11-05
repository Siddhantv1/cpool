import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Screen from "../components/Screen";
import TextField from "../components/TextField";
import { useTheme } from "../constants/theme";
import { deleteAccount } from "../lib/api";
import { clearSession, getSession } from "../lib/session";
import { useTrips } from "../lib/trips";

const GONE = [
  ["person-outline", "Your profile, phone number and picture"],
  ["car-outline", "Your vehicles and saved places"],
  ["time-outline", "Your ride history and alerts"],
];

// Account → Delete account (Google Play requires it inside the app): what gets deleted, then your password.
export default function DeleteAccount() {
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  const { booking, published } = useTrips();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Someone may be waiting for you: an open ride has to be cancelled first.
  const host = booking && ["requested", "accepted"].includes(booking.status) ? booking.host.name.split(" ")[0] : null;
  const openRide = host
    ? `You have a ride with ${host}. Cancel it first so ${host} isn’t left waiting, then delete your account.`
    : published
      ? `You’re hosting a ride (${published.when}). Cancel it first so nobody is left waiting, then delete your account.`
      : null;
  const ready = !!password && !loading;

  async function onDelete() {
    if (!ready) return;
    setError("");
    setLoading(true);
    try {
      await deleteAccount(getSession().email, password);
      clearSession();
      if (router.canDismiss()) router.dismissAll();
      router.replace({ pathname: "/welcome", params: { notice: "Your account has been deleted." } });
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }

  const button = (title, onPress, bg, fg, disabled = false) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled, busy: loading }}
      style={{ backgroundColor: disabled ? colors.disabled : bg, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: "center" }}
    >
      {loading && bg === colors.danger ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontWeight: "800", fontSize: fontSize.md }}>{title}</Text>}
    </Pressable>
  );

  if (openRide) {
    return (
      <Screen
        back
        title="Delete your account?"
        footer={
          <>
            {button("Go to my ride", () => router.push("/home"), colors.ink, colors.onInk)}
            {button("Back", () => router.back(), colors.surface, colors.text)}
          </>
        }
      >
        <View style={{ flexDirection: "row", gap: spacing.sm, backgroundColor: colors.warningSurface, borderRadius: radius.lg, padding: spacing.md }}>
          <Ionicons name="warning-outline" size={rs(19)} color={colors.warning} />
          <Text style={{ flex: 1, color: colors.warning, fontSize: fontSize.sm, lineHeight: rf(19) }}>{openRide}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      back
      title="Delete your account?"
      subtitle="This deletes everything below and signs you out on every phone."
      footer={
        <>
          {button("Delete my account", onDelete, colors.danger, colors.onPrimary, !ready)}
          {button("Keep my account", () => router.back(), colors.surface, colors.text)}
        </>
      }
    >
      <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, paddingHorizontal: spacing.md }}>
        {GONE.map(([icon, text], i) => (
          <View key={text} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, paddingVertical: spacing.sm + 2, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
            <Ionicons name={icon} size={rs(18)} color={colors.text} />
            <Text style={{ flex: 1, color: colors.text, fontSize: fontSize.sm + 1 }}>{text}</Text>
          </View>
        ))}
      </View>
      <Text style={{ color: colors.textMuted, fontSize: rf(11), fontWeight: "800", letterSpacing: 1 }}>ENTER YOUR PASSWORD TO CONFIRM</Text>
      <TextField
        label="Your password"
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          setError("");
        }}
        error={error}
        secure
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={onDelete}
      />
    </Screen>
  );
}
