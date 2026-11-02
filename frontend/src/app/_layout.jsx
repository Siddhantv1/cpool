import { router, Stack } from "expo-router";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import NotifyAsk from "../components/NotifyAsk";
import OfflineGate from "../components/OfflineGate";
import { setupNotifications, useNotificationTaps } from "../lib/notify";
import { answerRequest } from "../lib/trips";

// Accept / Decline on a seat-request notification; if the ride is already full, open the request instead.
function onNotificationAction(id, data) {
  if (id !== "accept" && id !== "decline") return false;
  if (answerRequest(data.reqId, id === "accept")) router.push("/home");
  else router.push({ pathname: "/request", params: { id: data.reqId } });
  return true;
}

export default function RootLayout() {
  useEffect(() => {
    setupNotifications();
  }, []);
  useNotificationTaps(onNotificationAction);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      {/* Screen component handles the safe area, so the default header is hidden. */}
      <Stack screenOptions={{ headerShown: false }} />
      <OfflineGate />
      <NotifyAsk />
    </GestureHandlerRootView>
  );
}
