import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import Button from "../../components/Button";
import Screen from "../../components/Screen";
import TextField from "../../components/TextField";
import { useTheme } from "../../constants/theme";
import { setPassword } from "../../lib/api";
import { passwordRules } from "../../lib/password";

// Used by both flows: purpose = "signup" (new account) or "reset" (forgot password).
export default function SetPassword() {
  const { token, email, purpose } = useLocalSearchParams();
  const { colors, spacing, fontSize } = useTheme();
  const [password, setPasswordText] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isReset = purpose === "reset";

  const rules = passwordRules(password, confirm);
  const allOk = rules.every((r) => r.ok);

  async function onSave() {
    if (!allOk) return;
    setError("");
    setLoading(true);
    try {
      await setPassword(token, password);
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
      title={isReset ? "Set a new password" : "Create a password"}
      footer={<Button title="Save password" onPress={onSave} loading={loading} disabled={!allOk} />}
    >
      <TextField
        label="Password"
        value={password}
        onChangeText={setPasswordText}
        secure
        autoFocus
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
