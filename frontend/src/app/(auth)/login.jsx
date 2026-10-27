import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import Button from "../../components/Button";
import Screen from "../../components/Screen";
import TextField from "../../components/TextField";
import { useTheme } from "../../constants/theme";
import { isWorkEmail, login } from "../../lib/api";
import { setSession } from "../../lib/session";

export default function Login() {
  const params = useLocalSearchParams();
  const { colors, spacing, fontSize, radius } = useTheme();
  const [email, setEmail] = useState(params.email ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notRegistered, setNotRegistered] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSignIn() {
    if (!isWorkEmail(email)) return setError("Use your perficient mail");
    if (!password) return setError("Enter your password");
    setError("");
    setNotRegistered(false);
    setLoading(true);
    try {
      const { token, role, vehicle } = await login(email.trim(), password);
      setSession({ email: email.trim().toLowerCase(), token, role, vehicle, vehicles: vehicle ? [vehicle] : [] });
      if (router.canDismiss()) router.dismissAll();
      // First sign-in (no role yet) goes to first-time setup.
      router.replace(role ? "/home" : "/role");
    } catch (e) {
      if (e.code === "not_registered") setNotRegistered(true);
      else setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen
      back
      title="Welcome back"
      subtitle="Sign in with your Company email"
      footer={
        <>
          <Button title="Sign in" onPress={onSignIn} loading={loading} disabled={!email.trim() || !password} />
          <Button title="New to Cpool? Sign up" variant="link" onPress={() => router.replace("/signup")} />
        </>
      }
    >
      {params.notice ? (
        <View style={{ backgroundColor: colors.successSurface, borderRadius: radius.lg, padding: spacing.md }}>
          <Text style={{ color: colors.success, fontSize: fontSize.sm, fontWeight: "600" }} accessibilityLiveRegion="polite">
            {params.notice}
          </Text>
        </View>
      ) : null}
      <TextField
        label="Work email"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          setError("");
          setNotRegistered(false);
        }}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        autoFocus={!params.email}
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          setError("");
        }}
        error={error}
        secure
        autoComplete="current-password"
        textContentType="password"
        autoFocus={!!params.email}
        onSubmitEditing={onSignIn}
      />
      {notRegistered ? (
        <View
          style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm }}
          accessibilityLiveRegion="polite"
        >
          <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: "700" }}>This email isn’t registered yet</Text>
          <Button
            title="Create an account"
            variant="secondary"
            onPress={() => router.replace({ pathname: "/signup", params: { email: email.trim() } })}
          />
        </View>
      ) : null}
      <View style={{ alignSelf: "flex-end" }}>
        <Button title="Forgot password?" variant="link" onPress={() => router.push({ pathname: "/forgot", params: { email } })} />
      </View>
    </Screen>
  );
}
