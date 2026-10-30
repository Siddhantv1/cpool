import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Keyboard, Pressable, Text, View } from "react-native";
import Button from "../../components/Button";
import { PersonAvatar } from "../../components/RideUI";
import Screen from "../../components/Screen";
import TextField from "../../components/TextField";
import { useTheme } from "../../constants/theme";
import { isMobile, setPassword } from "../../lib/api";
import { passwordRules } from "../../lib/password";

// Used by both flows: purpose = "signup" (new account: mobile number, gender for the default picture, password)
// or "reset" (forgot password).
export default function SetPassword() {
  const { token, email, purpose } = useLocalSearchParams();
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  const [password, setPasswordText] = useState("");
  const [confirm, setConfirm] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [gender, setGender] = useState(null); // "Female" | "Male" | "Prefer not to say"
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isReset = purpose === "reset";
  // Guided sign-up: when one part is done, the screen glides up to the next (number → gender → password).
  const scroll = useRef(null);
  const tops = useRef({});
  const passwordInput = useRef(null);
  const confirmInput = useRef(null);
  const goTo = (key, delay = 250) => setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, (tops.current[key] ?? 0) - rs(12)), animated: true }), delay);

  const rules = passwordRules(password, confirm);
  // No mobile number, no account: colleagues need it to call on ride day.
  const phoneOk = isReset || isMobile(phone);
  const phoneError = phoneTouched && !phoneOk ? "Enter your 10-digit mobile number" : "";
  const allOk = phoneOk && (isReset || !!gender) && rules.every((r) => r.ok);

  // The first gender choice moves on to the password and opens the keyboard there.
  function pickGender(g) {
    const first = !gender;
    setGender(g);
    if (!first || password) return;
    passwordInput.current?.focus();
    goTo("password", 400);
  }

  async function onSave() {
    if (!allOk) return;
    setError("");
    setLoading(true);
    try {
      await setPassword(token, password, isReset ? undefined : phone, isReset ? undefined : gender);
      const notice = isReset ? "Password updated." : "Account created. Sign in to continue";
      // Clear the sign-up / reset screens so Back doesn't return to them.
      if (router.canDismiss()) router.dismissAll();
      router.replace({ pathname: "/login", params: { email, notice } });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen
      scrollRef={scroll}
      back
      title={isReset ? "Set a new password" : "Set up your account"}
      subtitle={isReset ? undefined : "Add your mobile number and create a password."}
      footer={<Button title={isReset ? "Save password" : "Create account"} onPress={onSave} loading={loading} disabled={!allOk} />}
    >
      {isReset ? null : (
        <View onLayout={(e) => (tops.current.phone = e.nativeEvent.layout.y)}>
        <TextField
          label="Mobile number"
          prefix="+91"
          value={phone}
          onChangeText={(t) => {
            const digits = t.replace(/\D/g, "");
            setPhone(digits);
            if (isMobile(digits) && !gender) {
              Keyboard.dismiss();
              goTo("gender");
            }
          }}
          onBlur={() => setPhoneTouched(true)}
          error={phoneError}
          keyboardType="number-pad"
          maxLength={10}
          autoFocus
          autoComplete="tel-national"
          textContentType="telephoneNumber"
        />
        </View>
      )}
      {isReset ? null : (
        <View style={{ gap: spacing.sm }} onLayout={(e) => (tops.current.gender = e.nativeEvent.layout.y)}>
          <Text style={{ color: colors.textMuted, fontSize: rf(11), fontWeight: "800", letterSpacing: 1 }}>Gender</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }} accessibilityRole="radiogroup">
            {["Female", "Male"].map((g) => {
              const on = gender === g;
              return (
                <Pressable
                  key={g}
                  onPress={() => pickGender(g)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, padding: spacing.sm + 2, borderRadius: radius.lg, borderWidth: 2, borderColor: on ? colors.primary : colors.line, backgroundColor: on ? colors.primarySurface : colors.background }}
                >
                  <PersonAvatar gender={g} size={rs(44)} />
                  <Text style={{ flex: 1, color: on ? colors.primary : colors.text, fontWeight: "700", fontSize: fontSize.md }}>{g}</Text>
                  <View style={{ width: rs(20), height: rs(20), borderRadius: rs(10), borderWidth: on ? rs(6) : 2, borderColor: on ? colors.primary : colors.border }} />
                </Pressable>
              );
            })}
          </View>
          <Pressable onPress={() => pickGender("Prefer not to say")} accessibilityRole="radio" accessibilityState={{ checked: gender === "Prefer not to say" }} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "flex-start", paddingVertical: rs(4) }}>
            <View style={{ width: rs(18), height: rs(18), borderRadius: rs(9), borderWidth: gender === "Prefer not to say" ? rs(5) : 2, borderColor: gender === "Prefer not to say" ? colors.primary : colors.border }} />
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Prefer not to say</Text>
          </Pressable>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Enter the password for your account.</Text>
        </View>
      )}
      <View onLayout={(e) => (tops.current.password = e.nativeEvent.layout.y)} style={{ gap: spacing.md }}>
      <TextField
        ref={passwordInput}
        label="Password"
        value={password}
        onChangeText={setPasswordText}
        secure
        autoFocus={isReset}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmInput.current?.focus()}
      />
      <TextField
        ref={confirmInput}
        label="Re-enter password"
        value={confirm}
        onChangeText={setConfirm}
        secure
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={onSave}
        onFocus={() => setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 350)}
      />
      </View>
      <View style={{ gap: spacing.xs }} accessibilityLabel="Password rules">
        {rules.map((r) => (
          <Text key={r.label} style={{ color: r.ok ? colors.success : colors.textMuted, fontSize: fontSize.sm }}>
            {r.ok ? "✓" : "○"}  {r.label}
          </Text>
        ))}
      </View>
      {error ? (
        <Text style={{ color: colors.error, fontSize: fontSize.sm }} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </Screen>
  );
}
