import { Ionicons } from "@expo/vector-icons";
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

// One part of the sign-up form: a soft grey card with an icon and a title.
function Card({ icon, title, onLayout, children }) {
  const { colors, spacing, rs, rf } = useTheme();
  return (
    <View onLayout={onLayout} style={{ backgroundColor: colors.surface, borderRadius: rs(20), padding: spacing.md - 2, gap: spacing.sm + 2 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <View style={{ width: rs(28), height: rs(28), borderRadius: rs(9), backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} size={rs(16)} color={colors.primary} />
        </View>
        <Text accessibilityRole="header" style={{ color: colors.text, fontWeight: "700", fontSize: rf(14.5) }}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

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

  // The two password boxes and the rules: inside a card on sign-up, plain on password reset.
  const passwordPart = (
    <>
      <TextField
        ref={passwordInput}
        label="Password"
        value={password}
        onChangeText={setPasswordText}
        secure
        onCard={!isReset}
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
        onChangeText={(t) => {
          setConfirm(t);
          scroll.current?.scrollToEnd({ animated: true });
        }}
        secure
        onCard={!isReset}
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={onSave}
        onFocus={() => setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 350)}
      />
      <View style={{ gap: spacing.xs }} accessibilityLabel="Password rules">
        {rules.map((r) => (
          <Text key={r.label} style={{ color: r.ok ? colors.success : colors.textMuted, fontSize: fontSize.sm }}>
            {r.ok ? "✓" : "○"}  {r.label}
          </Text>
        ))}
      </View>
    </>
  );

  return (
    <Screen
      scrollRef={scroll}
      back
      title={isReset ? "Set a new password" : "Set up your account"}
      subtitle={isReset ? undefined : "Add your number, gender and password."}
      footer={<Button title={isReset ? "Save password" : "Create account"} onPress={onSave} loading={loading} disabled={!allOk} />}
    >
      {isReset ? (
        passwordPart
      ) : (
        <>
          <Card icon="phone-portrait-outline" title="Mobile number" onLayout={(e) => (tops.current.phone = e.nativeEvent.layout.y)}>
            <TextField
              label="Mobile number"
              prefix="+91"
              onCard
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
          </Card>
          <Card icon="person-outline" title="Gender" onLayout={(e) => (tops.current.gender = e.nativeEvent.layout.y)}>
            <View style={{ flexDirection: "row", gap: spacing.xs + 2 }} accessibilityRole="radiogroup">
              {["Female", "Male", "Prefer not to say"].map((g) => {
                const on = gender === g;
                return (
                  <Pressable
                    key={g}
                    onPress={() => pickGender(g)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={g}
                    style={{ flex: 1, alignItems: "center", gap: rs(4), paddingVertical: spacing.sm, paddingHorizontal: rs(4), borderRadius: radius.lg, borderWidth: 2, borderColor: on ? colors.primary : colors.background, backgroundColor: colors.background }}
                  >
                    <PersonAvatar gender={g} size={rs(40)} />
                    <Text style={{ color: on ? colors.primary : colors.text, fontWeight: "700", fontSize: rf(12.5), textAlign: "center" }}>{g === "Prefer not to say" ? "Prefer not\nto say" : g}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
          <Card icon="lock-closed-outline" title="Password" onLayout={(e) => (tops.current.password = e.nativeEvent.layout.y)}>
            {passwordPart}
          </Card>
        </>
      )}
      {error ? (
        <Text style={{ color: colors.error, fontSize: fontSize.sm }} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </Screen>
  );
}
