import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Image, Pressable, Text, View } from "react-native";
import Button from "../components/Button";
import Screen from "../components/Screen";
import TextField from "../components/TextField";
import { useTheme } from "../constants/theme";
import { isMobile } from "../lib/api";
import { displayName, getSession, updateSession } from "../lib/session";

const GENDERS = ["Male", "Female", "Prefer not to say"];

// Photo, name, mobile number and gender. Email can't change: it is how colleagues know you work at Perficient.
// shortcut: saved on this phone only; send it to PATCH /v1/me (photo as multipart) when the backend is ready.
export default function EditProfile() {
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  const session = getSession();
  const [photo, setPhoto] = useState(session?.photo ?? null);
  const [name, setName] = useState(session ? displayName(session) : "");
  const [gender, setGender] = useState(session?.gender ?? null);
  const [phone, setPhone] = useState(session?.phone?.replace(/^\+91/, "") ?? "");
  const [error, setError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  if (!session) return null;

  async function pick(source) {
    const ask = source === "camera" ? ImagePicker.requestCameraPermissionsAsync : ImagePicker.requestMediaLibraryPermissionsAsync;
    const { granted } = await ask();
    if (!granted) return Alert.alert("Permission needed", source === "camera" ? "Allow camera access in Settings to take a photo." : "Allow photo access in Settings to choose a photo.");
    const open = source === "camera" ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const result = await open({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  }

  function changePhoto() {
    Alert.alert("Profile photo", undefined, [
      { text: "Take photo", onPress: () => pick("camera") },
      { text: "Choose from gallery", onPress: () => pick("gallery") },
      ...(photo ? [{ text: "Remove photo", style: "destructive", onPress: () => setPhoto(null) }] : []),
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function save() {
    const clean = name.trim().replace(/\s+/g, " ");
    if (clean.length < 2) return setError("Enter your name.");
    if (clean.length > 40) return setError("Keep your name under 40 characters.");
    if (!isMobile(phone)) return setPhoneError("Enter your 10-digit mobile number");
    updateSession({ name: clean, gender, photo, phone: `+91${phone}` });
    router.back();
  }

  const initials = (name.trim() || "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <Screen back title="Edit profile" footer={<Button title="Save" onPress={save} />}>
      <Pressable onPress={changePhoto} accessibilityRole="button" accessibilityLabel="Change profile photo" style={{ alignSelf: "center", marginVertical: spacing.md }}>
        {photo ? (
          <Image source={{ uri: photo }} style={{ width: rs(112), height: rs(112), borderRadius: rs(56) }} accessible={false} />
        ) : (
          <View style={{ width: rs(112), height: rs(112), borderRadius: rs(56), backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: colors.onPrimary, fontSize: rf(38), fontWeight: "800" }}>{initials}</Text>
          </View>
        )}
        <View style={{ position: "absolute", right: 0, bottom: 0, width: rs(36), height: rs(36), borderRadius: rs(18), backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.background, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="camera" size={rs(16)} color={colors.onInk} />
        </View>
      </Pressable>

      <Text style={{ color: colors.textMuted, fontSize: rf(11), fontWeight: "800", letterSpacing: 1 }}>NAME</Text>
      <TextField label="Your name" value={name} onChangeText={(t) => {
          setName(t);
          setError("");
        }} error={error} autoCapitalize="words" maxLength={40} />

      <Text style={{ color: colors.textMuted, fontSize: rf(11), fontWeight: "800", letterSpacing: 1, marginTop: spacing.sm }}>MOBILE NUMBER</Text>
      <TextField label="Mobile number" prefix="+91" value={phone} onChangeText={(t) => {
          setPhone(t.replace(/\D/g, ""));
          setPhoneError("");
        }} error={phoneError} keyboardType="number-pad" maxLength={10} autoComplete="tel-national" textContentType="telephoneNumber" />

      <Text style={{ color: colors.textMuted, fontSize: rf(11), fontWeight: "800", letterSpacing: 1, marginTop: spacing.sm }}>GENDER</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }} accessibilityRole="radiogroup">
        {GENDERS.map((g) => (
          <Pressable
            key={g}
            onPress={() => setGender(g)}
            accessibilityRole="radio"
            accessibilityState={{ checked: gender === g }}
            style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderRadius: radius.pill, borderWidth: 1.5, borderColor: gender === g ? colors.ink : colors.line, backgroundColor: gender === g ? colors.ink : colors.background }}
          >
            <Text style={{ color: gender === g ? colors.onInk : colors.text, fontWeight: "700" }}>{g}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={{ color: colors.textMuted, fontSize: rf(11), fontWeight: "800", letterSpacing: 1, marginTop: spacing.sm }}>WORK EMAIL</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md }}>
        <Text style={{ flex: 1, color: colors.textMuted, fontSize: fontSize.md }}>{session.email}</Text>
        <Ionicons name="lock-closed" size={rs(15)} color={colors.textMuted} accessibilityLabel="Can't be changed" />
      </View>
    </Screen>
  );
}
