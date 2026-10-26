import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import Button from "../../components/Button";
import Screen from "../../components/Screen";
import { useTheme } from "../../constants/theme";
import { forgotPassword, signup, verifyCode } from "../../lib/api";

const LENGTH = 6;
const RESEND_SECONDS = 60;

// Used by both flows: purpose = "signup" (new account) or "reset" (forgot password).
export default function Verify() {
  const { email, purpose } = useLocalSearchParams();
  const { colors, spacing, fontSize, radius } = useTheme();
  const [digits, setDigits] = useState(Array(LENGTH).fill(""));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [resent, setResent] = useState(false);
  const inputs = useRef([]);

  // Count down once per second until 0.
  useEffect(() => {
    if (seconds === 0) return;
    const id = setTimeout(() => setSeconds(seconds - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);

  function onChange(index, text) {
    const typed = text.replace(/\D/g, "");
    const next = [...digits];
    // Several digits at once = pasted or auto-filled code: spread them over the boxes.
    typed.split("").slice(0, LENGTH - index).forEach((d, i) => (next[index + i] = d));
    if (!typed) next[index] = "";
    setDigits(next);
    setError("");
    setResent(false);
    if (typed) inputs.current[Math.min(index + typed.length, LENGTH - 1)]?.focus();
    // All boxes filled: check the code right away, no extra tap needed.
    if (next.every(Boolean)) submit(next.join(""));
  }

  function onKeyPress(index, key) {
    if (key === "Backspace" && !digits[index] && index > 0) inputs.current[index - 1]?.focus();
  }

  async function submit(code) {
    if (loading) return;
    if (code.length < LENGTH) return setError("Enter all 6 digits.");
    setLoading(true);
    try {
      const { token } = await verifyCode(email, code, purpose);
      router.push({ pathname: "/set-password", params: { token, email, purpose } });
    } catch (e) {
      setError(e.message);
      setDigits(Array(LENGTH).fill(""));
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    setError("");
    setDigits(Array(LENGTH).fill(""));
    setSeconds(RESEND_SECONDS);
    inputs.current[0]?.focus();
    try {
      await (purpose === "reset" ? forgotPassword(email) : signup(email));
      setResent(true);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <Screen
      back
      title="Enter the code"
      subtitle={`We sent a 6-digit code to ${email}`}
      footer={
        <>
          <Button title="Verify" onPress={() => submit(digits.join(""))} loading={loading} disabled={!digits.every(Boolean)} />
          <Button
            title={seconds > 0 ? `Resend code in ${seconds}s` : "Didn't get it? Resend code"}
            variant="link"
            onPress={onResend}
            disabled={seconds > 0}
          />
        </>
      }
    >
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {digits.map((digit, i) => (
          <TextInput
            key={i}
            ref={(el) => (inputs.current[i] = el)}
            value={digit}
            onChangeText={(text) => onChange(i, text)}
            onKeyPress={({ nativeEvent }) => onKeyPress(i, nativeEvent.key)}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={i === 0 ? LENGTH : 1}
            autoFocus={i === 0}
            editable={!loading}
            accessibilityLabel={`Digit ${i + 1} of ${LENGTH}`}
            style={{
              flex: 1,
              aspectRatio: 0.85,
              textAlign: "center",
              fontSize: fontSize.xl,
              fontWeight: "700",
              color: colors.text,
              backgroundColor: colors.surface,
              borderWidth: 1.5,
              borderColor: error ? colors.error : digit ? colors.primary : "transparent",
              borderRadius: radius.lg,
            }}
          />
        ))}
      </View>
      {error ? (
        <Text style={{ color: colors.error, fontSize: fontSize.sm }} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      {resent ? (
        <Text style={{ color: colors.success, fontSize: fontSize.sm }} accessibilityLiveRegion="polite">
          A new code is sent to your email 
        </Text>
      ) : null}
    </Screen>
  );
}
