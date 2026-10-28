import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Button from "../../components/Button";
import Screen from "../../components/Screen";
import { useTheme } from "../../constants/theme";
import { getDraft, updateDraft } from "../../lib/onboarding";

const TYPES = [
  {
    type: "bike",
    name: "Bike",
    seats: "1 guest seat",
    text: "Scooter or motorcycle. Next you'll choose who brings the pillion helmet.",
    photo: require("../../../assets/images/onboarding/bike.jpg"),
  },
  {
    type: "car",
    name: "Car",
    seats: "Up to 7 guest seats",
    text: "Hatchback, sedan, SUV or MUV. Next you'll choose how many seats to offer.",
    photo: require("../../../assets/images/onboarding/car.jpg"),
  },
];

function VehicleCard({ item, selected, onPress }) {
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${item.name}, ${item.seats}. ${item.text}`}
      style={{
        borderRadius: radius.lg + 6,
        overflow: "hidden",
        borderWidth: 2,
        borderColor: selected ? colors.primary : "transparent",
        backgroundColor: selected ? colors.primarySurface : colors.surface,
      }}
    >
      <View style={{ width: "100%", aspectRatio: 2 }}>
        <Image source={item.photo} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        <LinearGradient colors={[colors.onImageInk + "00", colors.onImageInk + "D9"]} locations={[0.4, 1]} style={StyleSheet.absoluteFill} />
        <Text style={{ position: "absolute", left: spacing.md, bottom: spacing.sm, color: colors.onImage, fontSize: fontSize.lg + 2, fontWeight: "900" }}>
          {item.name}
        </Text>
        <Text
          style={{
            position: "absolute",
            right: spacing.sm + 2,
            top: spacing.sm + 2,
            color: colors.onImage,
            backgroundColor: colors.onImageInk + "B8",
            fontSize: rf(11),
            fontWeight: "700",
            paddingHorizontal: spacing.sm + 2,
            paddingVertical: spacing.xs,
            borderRadius: radius.pill,
            overflow: "hidden",
          }}
        >
          {item.seats}
        </Text>
        {selected ? (
          <View
            style={{
              position: "absolute",
              left: spacing.sm + 2,
              top: spacing.sm + 2,
              width: rs(26),
              height: rs(26),
              borderRadius: radius.pill,
              backgroundColor: colors.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="checkmark" size={rs(16)} color={colors.onPrimary} />
          </View>
        ) : null}
      </View>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, lineHeight: rf(18), padding: spacing.md }}>{item.text}</Text>
    </Pressable>
  );
}

export default function VehicleType() {
  const [type, setType] = useState(getDraft().type ?? null);

  function onContinue() {
    updateDraft({ type });
    router.push(type === "bike" ? "/helmet" : "/seats");
  }

  return (
    <Screen
      back
      step={1}
      title="Which vehicle do you drive?"
      subtitle="Choose the one you'll use to offer rides."
      footer={<Button title="Continue" onPress={onContinue} disabled={!type} />}
    >
      {TYPES.map((item) => (
        <VehicleCard key={item.type} item={item} selected={type === item.type} onPress={() => setType(item.type)} />
      ))}
    </Screen>
  );
}
