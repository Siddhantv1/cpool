import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import Button from "../../components/Button";
import Screen from "../../components/Screen";
import TextField from "../../components/TextField";
import { forgotPassword, isWorkEmail } from "../../lib/api";

export default function ForgotPassword() {
  const params = useLocalSearchParams();
  const [email, setEmail] = useState(params.email ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onContinue() {
    if (!isWorkEmail(email)) return setError("Use your perficient mail");
    setError("");
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      router.push({ pathname: "/verify", params: { email: email.trim(), purpose: "reset" } });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen
      back
      title="Forgot your password?"
      subtitle="Enter your work email and we'll send you a code to set a new password"
      footer={<Button title="Send code" onPress={onContinue} loading={loading} disabled={!email.trim()} />}
    >
      <TextField
        label="Work email"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          setError("");
        }}
        error={error}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        onSubmitEditing={onContinue}
      />
    </Screen>
  );
}
