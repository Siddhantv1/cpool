import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar, Plate, Stops } from "../components/RideUI";
import { useTheme } from "../constants/theme";
import { goBack } from "../lib/nav";
import { playAlert } from "../lib/alerts";
import { clockPlus, useRoute } from "../lib/directions";
import { confirmWithdraw, declineBooking, useTrips } from "../lib/trips";

// Waiting for the host to answer a seat request.
export default function Requested() {
  const { colors, spacing, fontSize, radius, rs } = useTheme();
  const { booking } = useTrips();
  const [seconds, setSeconds] = useState(0);
  const [pulse] = useState(() => new Animated.Value(0));
  const ride = useRoute(booking ? [booking.pickup.coords, booking.drop.coords] : null);

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    loop.start();
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      loop.stop();
      clearInterval(tick);
    };
  }, [pulse]);

  // Leave exactly once when the request stops waiting (accepted, withdrawn, declined).
  // Navigating twice at the same time (back + redirect) left a blank white screen.
  const status = booking?.status;
  const leaving = useRef(false);
  useEffect(() => {
    if (leaving.current || status === "requested") return;
    leaving.current = true;
    if (status === "accepted") router.replace("/accepted");
    else if (router.canGoBack()) router.back();
    else router.replace("/home");
  }, [status]);

  if (status !== "requested") return null;
  const h = booking.host;
  const firstName = h.name.split(" ")[0];
  const waited = seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

  const withdraw = () => confirmWithdraw();

  const step = (done, active, title, subtitle) => (
    <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
      <View style={{ width: rs(24), height: rs(24), borderRadius: rs(12), alignItems: "center", justifyContent: "center", backgroundColor: done ? colors.green : active ? colors.primarySurface : colors.surface }}>
        {done ? <Ionicons name="checkmark" size={rs(14)} color={colors.onGreen} /> : <View style={{ width: rs(8), height: rs(8), borderRadius: rs(4), backgroundColor: active ? colors.primary : colors.border }} />}
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
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: rs(38), height: rs(38), borderRadius: radius.md + 2, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-back" size={rs(20)} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ alignItems: "center", gap: spacing.sm }}>
          <View style={{ width: rs(132), height: rs(132), alignItems: "center", justifyContent: "center" }}>
            <Animated.View
              style={{
                position: "absolute",
                width: rs(132),
                height: rs(132),
                borderRadius: rs(66),
                backgroundColor: colors.primary,
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
              }}
            />
            <Avatar initials={h.initials} color={h.color} size={rs(76)} />
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
            <MaterialCommunityIcons name={h.type === "bike" ? "motorbike" : "car"} size={rs(22)} color={colors.text} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>{h.name}</Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{h.vehicle}</Text>
            </View>
            <Plate text={h.plate} />
          </View>
          <Stops
            stops={[
              { title: booking.pickup.name, subtitle: "Pickup", time: h.time },
              { title: booking.drop.name, subtitle: "Drop", time: ride ? clockPlus(h.time, ride.minutes) : "" },
            ]}
          />
        </View>

        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Pressable onPress={withdraw} accessibilityRole="button" style={{ flex: 1, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.danger, borderRadius: radius.lg, paddingVertical: spacing.md }}>
            <Text style={{ color: colors.danger, fontWeight: "800" }}>Withdraw</Text>
          </Pressable>
        </View>
        {__DEV__ ? (
          // Development only: shows the "request declined" screen without a backend.
          <Pressable
            onPress={() => {
              leaving.current = true;
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
