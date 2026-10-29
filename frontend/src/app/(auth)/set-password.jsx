import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import Button from "../../components/Button";
import Screen from "../../components/Screen";
import TextField from "../../components/TextField";
import { useTheme } from "../../constants/theme";
import { isMobile, setPassword } from "../../lib/api";
import { passwordRules } from "../../lib/password";

// Used by both flows: purpose = "signup" (new account: mobile number + password) or "reset" (forgot password).
export default function SetPassword() {
  const { token, email, purpose } = useLocalSearchParams();
  const { colors, spacing, fontSize } = useTheme();
  const [password, setPasswordText] = useState("");
  const [confirm, setConfirm] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isReset = purpose === "reset";

  const rules = passwordRules(password, confirm);
  // No mobile number, no account: colleagues need it to call on ride day.
  const phoneOk = isReset || isMobile(phone);
  const phoneError = phoneTouched && !phoneOk ? "Enter your 10-digit mobile number" : "";
  const allOk = phoneOk && rules.every((r) => r.ok);

  async function onSave() {
    if (!allOk) return;
    setError("");
    setLoading(true);
    try {
      await setPassword(token, password, isReset ? undefined : phone);
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
      back
      title={isReset ? "Set a new password" : "Set up your account"}
      subtitle={isReset ? undefined : "Add your mobile number and create a password."}
      footer={<Button title={isReset ? "Save password" : "Create account"} onPress={onSave} loading={loading} disabled={!allOk} />}
    >
      {isReset ? null : (
        <TextField
          label="Mobile number"
          prefix="+91"
          value={phone}
          onChangeText={(t) => setPhone(t.replace(/\D/g, ""))}
          onBlur={() => setPhoneTouched(true)}
          error={phoneError}
          keyboardType="number-pad"
          maxLength={10}
          autoFocus
          autoComplete="tel-national"
          textContentType="telephoneNumber"
        />
      )}
      <TextField
        label="Password"
        value={password}
        onChangeText={setPasswordText}
        secure
        autoFocus={isReset}
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <TextField
        label="Re-enter password"
        value={confirm}
        onChangeText={setConfirm}
        secure
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={onSave}
      />
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
