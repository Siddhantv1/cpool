import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getAppearance, setAppearance, useTheme } from "../../constants/theme";
import { setRole } from "../../lib/api";
import { OFFICES } from "../../lib/mock";
import { resetDraft } from "../../lib/onboarding";
import { clearSession, displayName, getSession, updateSession } from "../../lib/session";
import { setPlace, useTrips } from "../../lib/trips";
const soon = (what) => () => Alert.alert("Coming soon", `${what} is on its way.`);

function Group({ title, action, onAction, children }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs }}>
        <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>{title}</Text>
        {action ? (
          <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}>
            <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 13 }}>{action}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Row({ icon, mc, title, subtitle, right, onPress, badge }) {
  const { colors, spacing, fontSize, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm + 4, borderBottomWidth: 1, borderBottomColor: colors.line, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
        {mc ? <MaterialCommunityIcons name={icon} size={19} color={colors.text} /> : <Ionicons name={icon} size={18} color={colors.text} />}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ color: colors.text, fontWeight: "600", fontSize: fontSize.md }}>{title}</Text>
          {badge ? (
            <Text style={{ color: colors.green, backgroundColor: colors.greenSurface, fontSize: 10, fontWeight: "800", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, overflow: "hidden" }}>{badge}</Text>
          ) : null}
        </View>
        {subtitle ? <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={17} color={colors.textMuted} /> : null)}
    </Pressable>
  );
}

export default function Account() {
  const { colors, spacing, fontSize, radius } = useTheme();
  const [, refresh] = useState(0);
  const { saved } = useTrips();
  useFocusEffect(useCallback(() => refresh((n) => n + 1), []));
  const session = getSession();
  if (!session) return null;

  const name = displayName(session);
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2);
  const vehicles = session.vehicles ?? (session.vehicle ? [session.vehicle] : []);
  const mode = session.role === "host" ? "host" : "guest";
  const set = (changes) => {
    updateSession(changes);
    refresh((n) => n + 1);
  };

  function addVehicle() {
    resetDraft();
    router.push("/vehicle-type");
  }
  function switchMode(next) {
    if (next === mode) return;
    if (next === "host" && !session.vehicle) return addVehicle();
    set({ role: next });
    setRole(session.email, next).catch(() => {});
  }
  const editProfile = () => router.push("/edit-profile");
  function logOut() {
    clearSession();
    router.replace("/welcome");
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: fontSize.xl - 4, fontWeight: "800" }}>Account</Text>

        {/* Profile header */}
        <View style={{ borderRadius: radius.lg + 6, overflow: "hidden", backgroundColor: colors.surface }}>
          <LinearGradient colors={["#1D4ED8", "#0F9D63"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 64 }} />
          <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md, marginTop: -36, gap: spacing.sm + 2 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: colors.surface, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
                {session.photo ? (
                  <Image source={{ uri: session.photo }} style={{ width: 66, height: 66, borderRadius: 33 }} accessibilityLabel="Your profile photo" />
                ) : (
                  <Text style={{ color: colors.onPrimary, fontSize: 24, fontWeight: "800" }}>{initials.toUpperCase()}</Text>
                )}
                <Pressable onPress={editProfile} accessibilityRole="button" accessibilityLabel="Change photo" style={{ position: "absolute", right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.background, borderWidth: 2, borderColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="pencil" size={12} color={colors.text} />
                </Pressable>
              </View>
              <Pressable onPress={editProfile} accessibilityRole="button" style={{ marginLeft: "auto", backgroundColor: colors.background, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>Edit profile</Text>
              </Pressable>
            </View>
            <View>
              <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: "800" }}>{name}</Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{session.email}{session.gender && session.gender !== "Prefer not to say" ? ` · ${session.gender}` : ""}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Text style={{ color: colors.green, backgroundColor: colors.greenSurface, fontSize: 11, fontWeight: "700", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, overflow: "hidden" }}>✓ Verified work email</Text>
              <Text style={{ color: colors.primary, backgroundColor: colors.primarySurface, fontSize: 11, fontWeight: "700", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, overflow: "hidden" }}>{mode === "host" ? "Host" : "Guest"}</Text>
            </View>
            <View style={{ flexDirection: "row", backgroundColor: colors.background, borderRadius: radius.lg, paddingVertical: spacing.sm + 2 }}>
              {[["12", "Rides taken"], ["8", "Rides given"], ["146 km", "Shared"]].map(([v, l], i) => (
                <View key={l} style={{ flex: 1, alignItems: "center", borderLeftWidth: i ? 1 : 0, borderLeftColor: colors.line }}>
                  <Text style={{ color: colors.text, fontSize: fontSize.lg - 3, fontWeight: "800" }}>{v}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "600" }}>{l}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Find / Offer */}
        <View style={{ flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.md + 2, padding: 3 }} accessibilityRole="tablist">
          {[["guest", "Find a ride"], ["host", "Offer a ride"]].map(([key, label]) => (
            <Pressable key={key} onPress={() => switchMode(key)} accessibilityRole="tab" accessibilityState={{ selected: mode === key }} style={{ flex: 1, alignItems: "center", paddingVertical: spacing.sm + 2, borderRadius: radius.md, backgroundColor: mode === key ? colors.background : "transparent" }}>
              <Text style={{ color: mode === key ? colors.text : colors.textMuted, fontWeight: "700" }}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <Group title="YOUR VEHICLES" action="＋ Add" onAction={addVehicle}>
          {vehicles.map((v) => (
            <Row
              key={v.number}
              mc
              icon={v.type === "bike" ? "motorbike" : "car"}
              title={v.model}
              badge={session.vehicle?.number === v.number ? "Default" : undefined}
              subtitle={`${v.number} · ${v.type === "bike" ? "1 seat" : `${v.seats} seats`}${v.helmet === "host" ? " · spare helmet" : ""}`}
              onPress={session.vehicle?.number === v.number ? undefined : () => set({ vehicle: v })}
              right={session.vehicle?.number === v.number ? null : <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>Make default</Text>}
            />
          ))}
          <Pressable onPress={addVehicle} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm + 4 }}>
            <View style={{ width: 36, height: 36, borderRadius: radius.md, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="add" size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={{ color: colors.primary, fontWeight: "700", fontSize: fontSize.md }}>Add a bike or car</Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Same steps as before: type, seats, RC</Text>
            </View>
          </Pressable>
        </Group>

        <Group title="SAVED PLACES">
          <Row icon="home-outline" title="Home" subtitle={saved.home.area} right={<Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>Edit</Text>} onPress={() => router.push({ pathname: "/places", params: { pick: "home" } })} />
          <Row
            icon="business-outline"
            title="Office"
            subtitle={`${saved.office.name} · ${saved.office.tag}`}
            right={<Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>Change</Text>}
            onPress={() =>
              Alert.alert("Your office", "Rides to work will go here by default.", [
                ...OFFICES.map((o) => ({ text: `${o.short} · ${o.tag}`, onPress: () => setPlace("office", o) })),
                { text: "Cancel", style: "cancel" },
              ])
            }
          />
        </Group>

        <Group title="SAFETY">
          <Row icon="shield-checkmark-outline" title="Emergency contacts" subtitle="2 contacts" onPress={soon("Emergency contacts")} />
          <Row
            icon="share-outline"
            title="Share trips automatically"
            subtitle="With your emergency contacts"
            right={<Switch value={!session.autoShareOff} onValueChange={(on) => set({ autoShareOff: !on })} accessibilityLabel="Share trips automatically" />}
          />
        </Group>

        <Group title="APP">
          <Row
            icon="volume-high-outline"
            title="Sounds & vibration"
            subtitle="Ride accepted, cancelled, host nearby"
            right={<Switch value={!session.soundsOff} onValueChange={(on) => set({ soundsOff: !on })} accessibilityLabel="Sounds and vibration" />}
          />
          <Row icon="notifications-outline" title="Notifications" right={<Text style={{ color: colors.textMuted }}>On</Text>} onPress={soon("Notification settings")} />
          <Row
            icon="moon-outline"
            title="Appearance"
            right={
              <View style={{ flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.pill, padding: 3 }} accessibilityRole="radiogroup" accessibilityLabel="Appearance">
                {[["system", "System"], ["light", "Light"], ["dark", "Dark"]].map(([key, label]) => (
                  <Pressable
                    key={key}
                    onPress={() => {
                      setAppearance(key);
                      refresh((n) => n + 1);
                    }}
                    accessibilityRole="radio"
                    accessibilityLabel={key === "system" ? "Same as phone" : label}
                    accessibilityState={{ checked: getAppearance() === key }}
                    style={{ paddingHorizontal: spacing.sm + 4, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: getAppearance() === key ? colors.ink : "transparent" }}
                  >
                    <Text style={{ color: getAppearance() === key ? colors.onInk : colors.textMuted, fontWeight: "700", fontSize: 12 }}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            }
          />
          <Row icon="key-outline" title="Change password" onPress={() => router.push("/change-password")} />
          <Row icon="lock-closed-outline" title="Privacy & data" onPress={soon("Privacy settings")} />
          <Row icon="help-circle-outline" title="Help & support" onPress={soon("Help & support")} />
        </Group>

        <Pressable onPress={logOut} accessibilityRole="button" style={{ alignItems: "center", paddingVertical: spacing.sm }}>
          <Text style={{ color: colors.danger, fontWeight: "800", fontSize: fontSize.md }}>Log out</Text>
        </Pressable>
        <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: "center", marginTop: -spacing.sm }}>Cpool 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
