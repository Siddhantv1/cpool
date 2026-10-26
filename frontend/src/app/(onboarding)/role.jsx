import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import Screen from "../../components/Screen";
import { useTheme } from "../../constants/theme";
import { setRole } from "../../lib/api";
import { resetDraft } from "../../lib/onboarding";
import { getSession, updateSession } from "../../lib/session";

const logo = require("../../../assets/images/logo.png");
const guestPhoto = require("../../../assets/images/onboarding/guest.jpg");
const hostPhoto = require("../../../assets/images/onboarding/host.jpg");

// Photo card, same shape as the approved design (240 x 176), with a colour fade from the left so the text stays readable.
function RoleCard({ photo, shade, tint, title, text, loading, onPress }) {
  const { colors, spacing, fontSize, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${text}`}
      accessibilityState={{ busy: loading }}
      style={({ pressed }) => ({ width: "100%", aspectRatio: 16 / 10, borderRadius: radius.lg + 8, overflow: "hidden", transform: [{ scale: pressed ? 0.98 : 1 }] })}
    >
      <Image source={photo} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} resizeMode="cover" />
      <LinearGradient
        colors={[shade + "F7", tint + "E0", tint + "26", tint + "00"]}
        locations={[0, 0.36, 0.72, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ flex: 1, padding: spacing.md + 4, width: "66%", gap: spacing.xs }}>
        <Text style={{ color: colors.onImage, fontSize: fontSize.lg + 4, fontWeight: "900", marginTop: "auto" }}>{title}</Text>
        <Text style={{ color: colors.onImage, opacity: 0.88, fontSize: fontSize.sm, lineHeight: 18 }}>{text}</Text>
      </View>
      <View
        style={{
          position: "absolute",
          right: spacing.md,
          bottom: spacing.md,
          width: 40,
          height: 40,
          borderRadius: radius.pill,
          backgroundColor: colors.onImage,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {loading ? <ActivityIndicator color={colors.onImageInk} /> : <Ionicons name="arrow-forward" size={20} color={colors.onImageInk} />}
      </View>
    </Pressable>
  );
}

export default function Role() {
  const { colors, spacing, fontSize, radius } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function chooseGuest() {
    setError("");
    setLoading(true);
    try {
      await setRole(getSession().email, "guest");
      updateSession({ role: "guest" });
      router.replace("/");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function chooseHost() {
    resetDraft();
    router.push("/vehicle-type");
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Image source={logo} style={{ width: 32, height: 32 }} accessible={false} />
        <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: "800" }}>Cpool</Text>
      </View>
      <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: fontSize.xxl, fontWeight: "900", lineHeight: 38 }}>
          How will you use Cpool?
        </Text>
        <LinearGradient colors={[colors.success, colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: 48, height: 5, borderRadius: radius.pill }} />
      </View>
      <RoleCard
        photo={guestPhoto}
        shade={colors.guestShade}
        tint={colors.guestTint}
        title="Find a ride"
        text="Join colleagues going your way"
        loading={loading}
        onPress={chooseGuest}
      />
      <RoleCard
        photo={hostPhoto}
        shade={colors.hostShade}
        tint={colors.hostTint}
        title="Offer a ride"
        text="Share your empty seats"
        onPress={chooseHost}
      />
      {error ? <Text style={{ color: colors.error, fontSize: fontSize.sm }}>{error}</Text> : null}
      <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, textAlign: "center", marginTop: "auto" }}>You can change this later in Profile.</Text>
    </Screen>
  );
}
