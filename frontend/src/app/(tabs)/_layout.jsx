import { Ionicons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { useTheme } from "../../constants/theme";
import { getSession } from "../../lib/session";
import { useTrips } from "../../lib/trips";

const icon = (name) =>
  function TabBarIcon({ color, focused, size }) {
    return <Ionicons name={focused ? name : `${name}-outline`} size={size} color={color} />;
  };

export default function TabsLayout() {
  const { colors } = useTheme();
  const trips = useTrips();
  if (!getSession()) return <Redirect href="/welcome" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.line },
        tabBarLabelStyle: { fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: icon("home") }} />
      <Tabs.Screen name="rides" options={{ title: "My rides", tabBarIcon: icon("calendar") }} />
      <Tabs.Screen
        name="alerts"
        options={{ title: "Alerts", tabBarIcon: icon("notifications"), tabBarBadge: trips.alerts.filter((a) => !a.read).length || undefined }}
      />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: icon("person") }} />
    </Tabs>
  );
}
