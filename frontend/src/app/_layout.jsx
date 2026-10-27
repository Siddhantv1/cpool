import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import OfflineGate from "../components/OfflineGate";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      {/* Screen component handles the safe area, so the default header is hidden. */}
      <Stack screenOptions={{ headerShown: false }} />
      <OfflineGate />
    </GestureHandlerRootView>
  );
}
