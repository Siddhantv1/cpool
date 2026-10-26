import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      {/* Screen component handles the safe area, so the default header is hidden. */}
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
