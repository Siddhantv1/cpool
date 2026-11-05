import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, LayoutAnimation, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "../../components/RideUI";
import { fonts, useTheme } from "../../constants/theme";
import { playAlert } from "../../lib/alerts";
import { ampm } from "../../lib/requestSeat";
import { confirmSheet } from "../../lib/confirm";
import { answerRequest, clearAlerts, markRead, removeAlert, useTrips } from "../../lib/trips";
import { ago } from "../../lib/when";

const KIND = {
  accepted: { icon: "checkmark", tone: "green" },
  declined: { icon: "remove", tone: "danger" },
  cancelled: { icon: "close", tone: "danger" },
  request: { icon: "person-add", tone: "primary" },
  in_car: { icon: "car", tone: "green" },
};
const kindOf = (a) => KIND[a.kind] ?? { icon: "notifications", tone: "primary" };
const DAY = 24 * 60 * 60 * 1000;

// Person photo (initials) with a small coloured badge showing what happened.
function AlertIcon({ alert }) {
  const { colors, rs } = useTheme();
  const k = kindOf(alert);
  return (
    <View style={{ width: rs(44), height: rs(44) }}>
      {alert.who ? (
        <Avatar initials={alert.who.initials} gender={alert.who.gender} color={alert.who.color} size={rs(44)} />
      ) : (
        <View style={{ width: rs(44), height: rs(44), borderRadius: rs(22), backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="car-outline" size={rs(20)} color={colors.text} />
        </View>
      )}
      <View style={{ position: "absolute", right: -rs(3), bottom: -rs(3), width: rs(20), height: rs(20), borderRadius: rs(10), backgroundColor: colors[k.tone], borderWidth: 2, borderColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={k.icon} size={rs(10)} color={colors.onImage} />
      </View>
    </View>
  );
}

// Empty space behind an alert while it is swiped away, so it just slides off and disappears.
const SwipeSpace = ({ width }) => <View style={{ width }} />;

// Alerts (approved design): your ride now on top, then what needs your answer, then updates grouped by day.
// Swipe an update to remove it; long press for more. Back arrow (no tab bar) or Android's back go to Home.
export default function Alerts() {
  const { colors, rs, rf } = useTheme();
  const { alerts, requests, booking } = useTrips();
  const rowWidth = useWindowDimensions().width - rs(32);
  const [now, setNow] = useState(Date.now);
  useFocusEffect(useCallback(() => setNow(Date.now()), []));

  const unread = alerts.filter((a) => !a.read).length;
  const pending = (a) => a.kind === "request" && requests.some((r) => r.id === a.reqId);
  const current = (a) => a.kind === "accepted" && booking?.status === "accepted" && now - a.at < DAY;
  const needs = alerts.filter(pending);
  const updates = alerts.filter((a) => !pending(a));
  const groups = [
    ["Today", updates.filter((a) => now - a.at < DAY)],
    ["Earlier", updates.filter((a) => now - a.at >= DAY)],
  ].filter(([, list]) => list.length);
  const live = booking?.status === "accepted" ? booking : null;

  function accept(a) {
    if (!answerRequest(a.reqId, true)) return Alert.alert("Your ride is full", "Every seat is taken. Decline this request or cancel a guest first.");
    markRead(a.id);
    playAlert("accepted");
  }
  function decline(a) {
    const name = requests.find((r) => r.id === a.reqId)?.name.split(" ")[0] ?? "this colleague";
    confirmSheet({
      title: `Decline ${name}’s request?`,
      text: "They’ll be told you can’t take them and can request another ride.",
      keep: "Back",
      confirm: "Decline",
      onConfirm: () => {
        answerRequest(a.reqId, false);
        markRead(a.id);
      },
    });
  }
  function open(a) {
    markRead(a.id);
    if (pending(a)) router.push({ pathname: "/request", params: { id: a.reqId } });
    else if (current(a)) router.push("/accepted");
  }
  // Remove the moment the finger lets go past the threshold; the rows below slide up smoothly.
  function dismiss(id) {
    LayoutAnimation.configureNext(LayoutAnimation.create(180, "easeInEaseOut", "opacity"));
    removeAlert(id);
  }
  function go(a, href) {
    markRead(a.id);
    router.push(href);
  }
  const more = (a) =>
    Alert.alert(a.title, undefined, [
      ...(a.read ? [] : [{ text: "Mark as read", onPress: () => markRead(a.id) }]),
      { text: "Remove alert", style: "destructive", onPress: () => removeAlert(a.id) },
      { text: "Cancel", style: "cancel" },
    ]);

  const txt = (style) => [{ color: colors.text, fontFamily: fonts.regular }, style];
  const link = (title, onPress) => (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={6} style={{ marginTop: rs(4), alignSelf: "flex-start" }}>
      <Text style={txt({ color: colors.primary, fontFamily: fonts.bold, fontSize: rf(13.5) })}>{title}</Text>
    </Pressable>
  );
  const pill = (title, onPress, dark) => (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ flex: 1, height: rs(42), borderRadius: rs(21), backgroundColor: dark ? colors.ink : colors.surface, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1 })}>
      <Text style={txt({ color: dark ? colors.onInk : colors.text, fontFamily: fonts.bold, fontSize: rf(14) })}>{title}</Text>
    </Pressable>
  );

  const row = (a, i) => (
    <Swipeable
      key={a.id}
      friction={1}
      dragOffsetFromLeft={8}
      dragOffsetFromRight={-8}
      leftThreshold={72}
      rightThreshold={72}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={() => <SwipeSpace width={rowWidth} />}
      renderRightActions={() => <SwipeSpace width={rowWidth} />}
      onSwipeableWillOpen={() => dismiss(a.id)}
    >
      <Pressable
        onPress={() => open(a)}
        onLongPress={() => more(a)}
        accessibilityRole="button"
        accessibilityLabel={`${a.read ? "" : "New. "}${a.title}. ${a.text}. ${ago(a.at, now)}`}
        accessibilityHint="Swipe left or right to remove. Long press for more options"
        accessibilityActions={[{ name: "remove", label: "Remove alert" }]}
        onAccessibilityAction={(e) => e.nativeEvent.actionName === "remove" && removeAlert(a.id)}
        style={({ pressed }) => ({ flexDirection: "row", gap: rs(12), paddingVertical: rs(12), paddingLeft: rs(12), backgroundColor: pressed ? colors.surface : colors.background, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line })}
      >
        {a.read ? null : <View style={{ position: "absolute", left: 0, top: rs(31), width: rs(6), height: rs(6), borderRadius: rs(3), backgroundColor: colors.primary }} />}
        <AlertIcon alert={a} />
        <View style={{ flex: 1, gap: rs(2) }}>
          <View style={{ flexDirection: "row", gap: rs(8) }}>
            <Text style={txt({ flex: 1, fontFamily: a.read ? fonts.semibold : fonts.extrabold, fontSize: rf(14.5) })}>{a.title}</Text>
            <Text style={txt({ color: colors.textMuted, fontSize: rf(12) })}>{ago(a.at, now)}</Text>
          </View>
          <Text style={txt({ color: colors.textMuted, fontSize: rf(13), lineHeight: rf(18) })}>{a.text}</Text>
          {current(a) ? link("Track ride", () => go(a, "/coming")) : a.cta === "find" && now - a.at < DAY ? link("Find another ride", () => go(a, "/results")) : null}
        </View>
      </Pressable>
    </Swipeable>
  );

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: rs(10), paddingHorizontal: rs(16), paddingTop: rs(8) }}>
        <Pressable onPress={() => router.navigate("/home")} accessibilityRole="button" accessibilityLabel="Back to Home" hitSlop={6} style={{ width: rs(42), height: rs(42), borderRadius: rs(21), backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-back" size={rs(22)} color={colors.text} />
        </Pressable>
        <Text accessibilityRole="header" style={txt({ flex: 1, fontFamily: fonts.extrabold, fontSize: rf(28), letterSpacing: -0.5 })}>
          Alerts
        </Text>
        {alerts.length ? (
          <Pressable onPress={clearAlerts} accessibilityRole="button" accessibilityLabel="Clear all alerts" hitSlop={8} style={({ pressed }) => ({ height: rs(34), borderRadius: rs(17), paddingHorizontal: rs(14), justifyContent: "center", backgroundColor: pressed ? colors.line : colors.surface })}>
            <Text style={txt({ fontFamily: fonts.bold, fontSize: rf(13.5) })}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={txt({ color: colors.textMuted, fontSize: rf(14), marginLeft: rs(68) })}>{needs.length ? `${needs.length} need${needs.length === 1 ? "s" : ""} you` : unread ? `${unread} new` : "You’re all caught up"}</Text>

      <ScrollView contentContainerStyle={{ padding: rs(16), paddingTop: rs(14), gap: rs(10) }}>
        {live ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: rs(12), borderWidth: 1, borderColor: colors.line, borderRadius: rs(20), padding: rs(12) }}>
            <Avatar initials={live.host.initials} gender={live.host.gender} color={live.host.color} size={rs(44)} />
            <View style={{ flex: 1 }}>
              <Text style={txt({ fontFamily: fonts.bold, fontSize: rf(15) })}>Riding with {live.host.name.split(" ")[0]}</Text>
              <Text style={txt({ color: colors.textMuted, fontSize: rf(12.5) })}>
                Pickup {live.host.time} {ampm(live.host.time)} · {live.host.plate}
              </Text>
            </View>
            <Pressable onPress={() => router.push("/coming")} accessibilityRole="button" style={{ height: rs(38), borderRadius: rs(19), backgroundColor: colors.ink, paddingHorizontal: rs(16), justifyContent: "center" }}>
              <Text style={txt({ color: colors.onInk, fontFamily: fonts.bold, fontSize: rf(13.5) })}>Track</Text>
            </Pressable>
          </View>
        ) : null}

        {needs.length ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: rs(8), marginTop: rs(8) }}>
              <Text style={txt({ fontFamily: fonts.extrabold, fontSize: rf(16) })}>Needs you</Text>
              <View style={{ minWidth: rs(20), height: rs(20), borderRadius: rs(10), backgroundColor: colors.danger, alignItems: "center", justifyContent: "center", paddingHorizontal: rs(6) }}>
                <Text style={txt({ color: colors.onImage, fontFamily: fonts.bold, fontSize: rf(11.5) })}>{needs.length}</Text>
              </View>
            </View>
            {needs.map((a) => (
              <Pressable key={a.id} onPress={() => open(a)} accessibilityRole="button" accessibilityLabel={`${a.title}. ${a.text}. Open request`} style={{ borderWidth: 1, borderColor: colors.line, borderRadius: rs(20), padding: rs(14), gap: rs(12) }}>
                <View style={{ flexDirection: "row", gap: rs(12) }}>
                  <AlertIcon alert={a} />
                  <View style={{ flex: 1 }}>
                    <Text style={txt({ fontFamily: fonts.extrabold, fontSize: rf(15) })}>{a.title}</Text>
                    <Text style={txt({ color: colors.textMuted, fontSize: rf(13), lineHeight: rf(18) })}>{a.text}</Text>
                  </View>
                  <Text style={txt({ color: colors.textMuted, fontSize: rf(12) })}>{ago(a.at, now)}</Text>
                </View>
                <View style={{ flexDirection: "row", gap: rs(10) }}>
                  {pill("Decline", () => decline(a))}
                  {pill("Accept", () => accept(a), true)}
                </View>
              </Pressable>
            ))}
          </>
        ) : null}

        {groups.map(([title, list]) => (
          <View key={title} style={{ marginTop: rs(8) }}>
            <Text style={txt({ fontFamily: fonts.extrabold, fontSize: rf(16), marginBottom: rs(4) })}>{title}</Text>
            {list.map(row)}
          </View>
        ))}

        {!needs.length && !groups.length && !live ? (
          <View style={{ alignItems: "center", gap: rs(8), marginTop: rs(80), paddingHorizontal: rs(24) }}>
            <View style={{ width: rs(96), height: rs(96), borderRadius: rs(48), backgroundColor: colors.greenSurface, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="notifications-outline" size={rs(42)} color={colors.green} />
            </View>
            <Text style={txt({ fontFamily: fonts.extrabold, fontSize: rf(22), marginTop: rs(10) })}>You’re all caught up</Text>
            <Text style={txt({ color: colors.textMuted, fontSize: rf(14), textAlign: "center", lineHeight: rf(20) })}>Seat requests and ride updates show up here.</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
