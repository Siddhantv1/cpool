import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import Button from "../components/Button";
import Screen from "../components/Screen";
import TextField from "../components/TextField";
import { useTheme } from "../constants/theme";
import { changePassword } from "../lib/api";
import { passwordRules } from "../lib/password";
import { getSession } from "../lib/session";

// Account → Change password: confirm the current password, then pick a new one.
export default function ChangePassword() {
  const { colors, spacing, fontSize } = useTheme();
  const session = getSession();
  const [current, setCurrent] = useState("");
  const [password, setPasswordText] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  if (!session) return null;

  const rules = [...passwordRules(password, confirm), { label: "Different from your current password", ok: password.length > 0 && password !== current }];
  const allOk = current.length > 0 && rules.every((r) => r.ok);

  async function onSave() {
    if (!allOk) return;
    setError("");
    setLoading(true);
    try {
      await changePassword(session.email, current, password);
      Alert.alert("Password changed", "Use your new password next time you sign in.");
      router.back();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen back title="Change password" footer={<Button title="Save new password" onPress={onSave} loading={loading} disabled={!allOk} />}>
      <TextField
        label="Current password"
        value={current}
        onChangeText={(t) => {
          setCurrent(t);
          setError("");
        }}
        secure
        autoFocus
        autoComplete="current-password"
        textContentType="password"
      />
      <Pressable onPress={() => router.push({ pathname: "/forgot", params: { email: session.email } })} accessibilityRole="button" hitSlop={8} style={{ alignSelf: "flex-start" }}>
        <Text style={{ color: colors.primary, fontWeight: "700", fontSize: fontSize.sm }}>Forgot your current password?</Text>
      </Pressable>
      <View style={{ height: spacing.sm }} />
      <TextField label="New password" value={password} onChangeText={setPasswordText} secure autoComplete="new-password" textContentType="newPassword" />
      <TextField label="Re-enter new password" value={confirm} onChangeText={setConfirm} secure autoComplete="new-password" textContentType="newPassword" onSubmitEditing={onSave} />
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
