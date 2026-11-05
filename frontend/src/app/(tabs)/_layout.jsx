import { Redirect } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { getSession } from "../../lib/session";

// No bottom tab bar: Home's top bar opens Account (your picture) and Alerts (the bell); both have a back arrow.
// Android's back button returns to Home (the first tab).
export default function TabsLayout() {
  if (!getSession()) return <Redirect href="/welcome" />;
  return (
    <Tabs backBehavior="firstRoute" screenOptions={{ headerShown: false, tabBarStyle: { display: "none" } }}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="alerts" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}
