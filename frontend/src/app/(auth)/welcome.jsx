import { router } from "expo-router";
import { Image, Text, View } from "react-native";
import Button from "../../components/Button";
import Screen from "../../components/Screen";
import { useTheme } from "../../constants/theme";

const logo = require("../../../assets/images/logo.png");

export default function Welcome() {
  const { colors, spacing, fontSize, rs, rf } = useTheme();
  const big = { fontSize: rf(56), lineHeight: rf(60), fontWeight: "800", color: colors.text };

  return (
    <Screen
      footer={
        <>
          <Button title="Sign in" onPress={() => router.push("/login")} />
          <Button title="Sign up" variant="secondary" onPress={() => router.push("/signup")} />
        </>
      }
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Image source={logo} style={{ width: rs(40), height: rs(40) }} accessible={false} />
        <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: "800" }}>Cpool</Text>
      </View>

      <View style={{ flex: 1, justifyContent: "center", gap: spacing.md }}>
        <Text accessibilityRole="header" accessibilityLabel="Ride. Share. Save.">
          <Text style={big}>Ride.{"\n"}Share.{"\n"}</Text>
          <Text style={[big, { color: colors.success }]}>Save.</Text>
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.md, lineHeight: rf(22) }}>
          The carpool app for Perficient colleagues
        </Text>
      </View>
    </Screen>
  );
}
