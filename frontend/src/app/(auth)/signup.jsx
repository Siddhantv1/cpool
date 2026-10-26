import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import Button from "../../components/Button";
import Screen from "../../components/Screen";
import TextField from "../../components/TextField";
import { isWorkEmail, signup } from "../../lib/api";

export default function SignUp() {
  const params = useLocalSearchParams();
  // Filled in when coming from Sign in with an email that isn't registered.
  const [email, setEmail] = useState(params.email ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onContinue() {
    // Client check is only for a nicer message; the server check is the real one.
    if (!isWorkEmail(email)) return setError("Use your perficient Mail");
    setError("");
    setLoading(true);
    try {
      await signup(email.trim());
      router.push({ pathname: "/verify", params: { email: email.trim(), purpose: "signup" } });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen
      back
      title="What's your work email?"
      subtitle="We'll send a 6-digit code to your Perficient email to check it's you"
      footer={
        <>
          <Button title="Continue" onPress={onContinue} loading={loading} disabled={!email.trim()} />
          <Button title="Already have an account? Sign in" variant="link" onPress={() => router.replace("/login")} />
        </>
      }
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
        returnKeyType="next"
        onSubmitEditing={onContinue}
      />
    </Screen>
  );
}
