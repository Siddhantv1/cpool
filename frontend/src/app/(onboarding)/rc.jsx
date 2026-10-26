import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { extractTextFromImage, isSupported } from "expo-text-extractor";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Button from "../../components/Button";
import Screen from "../../components/Screen";
import { useTheme } from "../../constants/theme";
import { updateDraft } from "../../lib/onboarding";
import { parseRc } from "../../lib/vehicle";

// Small drawing of an RC card (no image file needed).
function RcIllustration() {
  const { colors, spacing, radius } = useTheme();
  const line = (w, dark) => <View style={{ width: w, height: dark ? 7 : 5, borderRadius: 3, backgroundColor: dark ? colors.onImageInk : colors.border }} />;
  return (
    <LinearGradient colors={[colors.primarySurface, colors.background]} style={{ borderRadius: radius.lg + 6, alignItems: "center", paddingVertical: spacing.lg }}>
      <View style={{ width: 200, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.onImage }} accessible={false}>
        <View style={{ backgroundColor: colors.primary, paddingHorizontal: spacing.sm + 2, paddingVertical: 6 }}>
          <Text style={{ color: colors.onPrimary, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 }}>REGISTRATION CERTIFICATE</Text>
        </View>
        <View style={{ flexDirection: "row", gap: spacing.sm + 2, padding: spacing.sm + 2 }}>
          <View style={{ width: 36, height: 44, borderRadius: 4, backgroundColor: colors.border }} />
          <View style={{ flex: 1, gap: 6, paddingTop: 2 }}>
            {line("75%", true)}
            {line("100%")}
            {line("85%")}
            {line("60%")}
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

function Tip({ icon, text }) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", gap: spacing.xs, backgroundColor: colors.surface, borderRadius: radius.md + 2, paddingVertical: spacing.sm + 2 }}>
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <Text style={{ color: colors.textMuted, fontSize: 11 }}>{text}</Text>
    </View>
  );
}

function SourceButton({ icon, title, primary, onPress, disabled }) {
  const { colors, spacing, fontSize, radius } = useTheme();
  const fg = primary ? colors.onPrimary : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        gap: spacing.xs + 2,
        paddingVertical: spacing.md,
        borderRadius: radius.lg + 2,
        backgroundColor: primary ? colors.primary : colors.surface,
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      <Ionicons name={icon} size={24} color={fg} />
      <Text style={{ color: fg, fontSize: fontSize.sm, fontWeight: "700" }}>{title}</Text>
    </Pressable>
  );
}

export default function AddRc() {
  const { colors, spacing, fontSize, radius } = useTheme();
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");

  async function pick(source) {
    setError("");
    const ask = source === "camera" ? ImagePicker.requestCameraPermissionsAsync : ImagePicker.requestMediaLibraryPermissionsAsync;
    const { granted } = await ask();
    if (!granted) {
      return setError(source === "camera" ? "Allow camera access in Settings to take a photo." : "Allow photo access in Settings to choose a photo.");
    }
    const open = source === "camera" ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const result = await open({ mediaTypes: ["images"], quality: 0.9 });
    if (result.canceled) return;
    if (!isSupported) return setError("This phone can't read text from photos. Enter the details manually.");

    setReading(true);
    try {
      // Text is read on the phone; the photo is never uploaded or saved.
      const details = parseRc(await extractTextFromImage(result.assets[0].uri));
      if (!details.number || !details.model || !details.mfgMonth || !details.mfgYear) {
        setError("We couldn't read all the details. Retake the photo in good light, or enter them manually.");
        return;
      }
      updateDraft({ vehicle: details, rcPhoto: result.assets[0].uri });
      router.push({ pathname: "/vehicle-details", params: { mode: "rc" } });
    } catch {
      setError("Something went wrong reading the photo. Try again, or enter the details manually.");
    } finally {
      setReading(false);
    }
  }

  return (
    <Screen
      back
      step={3}
      title="Add your vehicle's RC"
      subtitle="We'll read the number, model and year for you."
      footer={
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>or</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>
          <Button
            title="Enter details manually"
            variant="secondary"
            disabled={reading}
            onPress={() => router.push({ pathname: "/vehicle-details", params: { mode: "manual" } })}
          />
        </>
      }
    >
      <RcIllustration />
      {reading ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.lg }} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: "600" }}>Reading your RC…</Text>
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <SourceButton icon="camera-outline" title="Take photo" primary onPress={() => pick("camera")} />
          <SourceButton icon="images-outline" title="Upload from gallery" onPress={() => pick("gallery")} />
        </View>
      )}
      {error ? (
        <View style={{ backgroundColor: colors.warningSurface, borderRadius: radius.md + 2, padding: spacing.sm + 4 }} accessibilityLiveRegion="polite">
          <Text style={{ color: colors.warning, fontSize: fontSize.sm, lineHeight: 19 }}>{error}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Tip icon="scan-outline" text="All corners" />
        <Tip icon="sunny-outline" text="No glare" />
        <Tip icon="document-text-outline" text="Text readable" />
      </View>
      <View style={{ flexDirection: "row", gap: spacing.xs + 2 }}>
        <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} style={{ marginTop: 2 }} />
        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, flex: 1, lineHeight: 18 }}>
          Used only to read your vehicle details. The photo and your address are never saved.
        </Text>
      </View>
    </Screen>
  );
}
