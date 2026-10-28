import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import Button from "../../components/Button";
import OptionCard from "../../components/OptionCard";
import Screen from "../../components/Screen";
import { useTheme } from "../../constants/theme";
import { getDraft, updateDraft } from "../../lib/onboarding";

export default function Helmet() {
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  const [helmet, setHelmet] = useState(getDraft().helmet ?? "host");

  function onContinue() {
    updateDraft({ helmet, seats: 1 });
    router.push("/rc");
  }

  return (
    <Screen back step={2} footer={<Button title="Continue" onPress={onContinue} />}>
      <LinearGradient
        colors={[colors.primarySurface, colors.background]}
        style={{ borderRadius: radius.lg + 8, alignItems: "center", justifyContent: "center", paddingVertical: spacing.lg }}
      >
        <MaterialCommunityIcons name="racing-helmet" size={rs(96)} color={colors.primary} />
      </LinearGradient>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: fontSize.xl, fontWeight: "900" }}>
        Helmet for your pillion?
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.md, lineHeight: rf(22) }}>Guests see this before they request your ride.</Text>
      <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup">
        <OptionCard
          icon={<MaterialCommunityIcons name="racing-helmet" size={rs(22)} color={colors.primary} />}
          title="I'll carry a spare helmet"
          description="Your guest doesn't need to bring one"
          selected={helmet === "host"}
          onPress={() => setHelmet("host")}
        />
        <OptionCard
          icon={<Ionicons name="person-outline" size={rs(22)} color={colors.textMuted} />}
          title="Guest brings their own"
          description="We'll remind them before the ride"
          selected={helmet === "guest"}
          onPress={() => setHelmet("guest")}
        />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.warningSurface, borderRadius: radius.md + 2, padding: spacing.sm + 4 }}>
        <Ionicons name="shield-checkmark-outline" size={rs(18)} color={colors.warning} />
        <Text style={{ color: colors.warning, fontSize: fontSize.sm, flex: 1 }}>Helmets are mandatory for pillion riders in India.</Text>
      </View>
    </Screen>
  );
}
