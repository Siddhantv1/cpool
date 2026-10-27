import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Animated, Easing, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar, call, Plate, Stops } from "../components/RideUI";
import { useTheme } from "../constants/theme";
import { playAlert } from "../lib/alerts";
import { clearBooking, declineBooking, useTrips, withdrawBooking } from "../lib/trips";

// Waiting for the host to answer a seat request.
export default function Requested() {
  const { colors, spacing, fontSize, radius } = useTheme();
  const { booking } = useTrips();
  const [seconds, setSeconds] = useState(0);
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    loop.start();
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      loop.stop();
      clearInterval(tick);
    };
  }, [pulse]);

  // The host answered while this screen is open.
  const status = booking?.status;
  useEffect(() => {
    if (status === "accepted") router.replace("/accepted");
  }, [status]);

  if (!booking || booking.status !== "requested") return status === "accepted" ? null : <Redirect href="/home" />;
  const h = booking.host;
  const firstName = h.name.split(" ")[0];
  const waited = seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

  function withdraw() {
    Alert.alert("Withdraw your request?", `${firstName} won't see it any more.`, [
      { text: "Keep waiting", style: "cancel" },
      {
        text: "Withdraw",
        style: "destructive",
        onPress: () => {
          withdrawBooking();
          clearBooking();
          router.back();
        },
      },
    ]);
  }

  const step = (done, active, title, subtitle) => (
    <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: done ? colors.green : active ? colors.primarySurface : colors.surface }}>
        {done ? <Ionicons name="checkmark" size={14} color={colors.onGreen} /> : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: active ? colors.primary : colors.border }} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: done || active ? colors.text : colors.textMuted, fontWeight: "700" }}>{title}</Text>
        {subtitle ? <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{subtitle}</Text> : null}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 38, height: 38, borderRadius: radius.md + 2, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ alignItems: "center", gap: spacing.sm }}>
          <View style={{ width: 132, height: 132, alignItems: "center", justifyContent: "center" }}>
            <Animated.View
              style={{
                position: "absolute",
                width: 132,
                height: 132,
                borderRadius: 66,
                backgroundColor: colors.primary,
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
              }}
            />
            <Avatar initials={h.initials} color={h.color} size={76} />
          </View>
          <Text accessibilityRole="header" style={{ color: colors.text, fontSize: fontSize.xl - 4, fontWeight: "800" }}>Request sent</Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.md, textAlign: "center" }} accessibilityLiveRegion="polite">
            Waiting for {firstName} to accept · {waited}
          </Text>
        </View>

        <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg + 4, padding: spacing.md, gap: spacing.md }}>
          {step(true, false, "Request sent", "Just now")}
          {step(false, true, `${firstName} is reviewing`, "Hosts usually reply within 10 minutes")}
          {step(false, false, "Seat confirmed", "We’ll notify you with a sound")}
        </View>

        <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg + 4, padding: spacing.md, gap: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <MaterialCommunityIcons name={h.type === "bike" ? "motorbike" : "car"} size={22} color={colors.text} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>{h.name}</Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{h.vehicle}</Text>
            </View>
            <Plate text={h.plate} />
          </View>
          <Stops
            stops={[
              { title: "HSR Layout · 27th Main", subtitle: `Pickup · ${h.walkTo} walk`, time: h.time },
              { title: "Perficient Bellandur", subtitle: "Drop", time: "9:15" },
            ]}
          />
        </View>

        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Pressable onPress={() => call(h.phone)} accessibilityRole="button" style={{ flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: spacing.md }}>
            <Ionicons name="call-outline" size={18} color={colors.text} />
            <Text style={{ color: colors.text, fontWeight: "800" }}>Call {firstName}</Text>
          </Pressable>
          <Pressable onPress={withdraw} accessibilityRole="button" style={{ flex: 1, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.danger, borderRadius: radius.lg, paddingVertical: spacing.md }}>
            <Text style={{ color: colors.danger, fontWeight: "800" }}>Withdraw</Text>
          </Pressable>
        </View>
        {__DEV__ ? (
          // Development only: shows the "request declined" screen without a backend.
          <Pressable
            onPress={() => {
              declineBooking();
              playAlert("cancelled");
              router.replace({ pathname: "/cancelled", params: { kind: "declined" } });
            }}
            accessibilityRole="button"
            style={{ alignItems: "center", padding: spacing.sm }}
          >
            <Text style={{ color: colors.textMuted, fontWeight: "600" }}>Demo: host declines</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
