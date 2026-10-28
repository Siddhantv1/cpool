import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, LayoutAnimation, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "../../components/RideUI";
import { useTheme } from "../../constants/theme";
import { playAlert } from "../../lib/alerts";
import { answerRequest, markRead, removeAlert, useTrips } from "../../lib/trips";
import { ago } from "../../lib/when";

const KIND = {
  accepted: { icon: "checkmark", tone: "green", group: "rides" },
  declined: { icon: "remove", tone: "danger", group: "rides" },
  cancelled: { icon: "close", tone: "danger", group: "rides" },
  request: { icon: "person-add", tone: "primary", group: "requests" },
};
const TABS = [
  ["all", "All"],
  ["rides", "Rides"],
  ["requests", "Requests"],
];
const DAY = 24 * 60 * 60 * 1000;

// Person photo (initials) with a small coloured badge showing what happened.
function AlertIcon({ alert }) {
  const { colors, rs } = useTheme();
  const k = KIND[alert.kind];
  const tone = colors[k.tone];
  return (
    <View style={{ width: rs(48), height: rs(48) }}>
      {alert.who ? (
        <Avatar initials={alert.who.initials} color={alert.who.color} size={rs(48)} />
      ) : (
        <View
          style={{
            width: rs(48),
            height: rs(48),
            borderRadius: rs(24),
            backgroundColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="car-outline" size={rs(22)} color={colors.text} />
        </View>
      )}
      <View
        style={{
          position: "absolute",
          right: -rs(3),
          bottom: -rs(3),
          width: rs(22),
          height: rs(22),
          borderRadius: rs(11),
          backgroundColor: tone,
          borderWidth: 2,
          borderColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={k.icon} size={rs(11)} color={colors.onImage} />
      </View>
    </View>
  );
}

// Empty space behind an alert while it is swiped away, so it just slides off and disappears.
const SwipeSpace = ({ width }) => <View style={{ width }} />;

function SmallButton({ title, onPress, kind = "plain" }) {
  const { colors, spacing, radius, rf } = useTheme();
  const bg = { green: colors.green, ink: colors.ink, plain: colors.surface }[kind];
  const fg = { green: colors.onGreen, ink: colors.onInk, plain: colors.text }[kind];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        backgroundColor: bg,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text style={{ color: fg, fontWeight: "800", fontSize: rf(13) }}>{title}</Text>
    </Pressable>
  );
}

export default function Alerts() {
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  const { alerts, requests, booking } = useTrips();
  const [tab, setTab] = useState("all");
  const rowWidth = useWindowDimensions().width - spacing.lg * 2;
  const [now, setNow] = useState(Date.now);
  useFocusEffect(useCallback(() => setNow(Date.now()), []));

  const items = alerts.filter((a) => tab === "all" || KIND[a.kind].group === tab);
  const unread = alerts.filter((a) => !a.read).length;
  const count = (key) => alerts.filter((a) => !a.read && (key === "all" || KIND[a.kind].group === key)).length;
  const sections = [
    ["New", items.filter((a) => !a.read)],
    ["Today", items.filter((a) => a.read && now - a.at < DAY)],
    ["Earlier", items.filter((a) => a.read && now - a.at >= DAY)],
  ].filter(([, list]) => list.length);

  const pending = (a) => a.kind === "request" && requests.some((r) => r.id === a.reqId);
  const current = (a) => a.kind === "accepted" && booking?.status === "accepted" && now - a.at < DAY;

  function accept(a) {
    answerRequest(a.reqId, true);
    markRead(a.id);
    playAlert("accepted");
  }
  function decline(a) {
    Alert.alert("Decline this request?", "They’ll be told you can’t take them this time.", [
      { text: "Back", style: "cancel" },
      {
        text: "Decline",
        style: "destructive",
        onPress: () => {
          answerRequest(a.reqId, false);
          markRead(a.id);
        },
      },
    ]);
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
      {
        text: "Remove alert",
        style: "destructive",
        onPress: () => removeAlert(a.id),
      },
      { text: "Cancel", style: "cancel" },
    ]);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          gap: spacing.md,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              accessibilityRole="header"
              style={{
                color: colors.text,
                fontSize: fontSize.xl - 4,
                fontWeight: "800",
              }}
            >
              Alerts
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{unread ? `${unread} new` : "You’re up to date"}</Text>
          </View>
          <Pressable
            onPress={() => router.push("/account")}
            accessibilityRole="button"
            accessibilityLabel="Alert settings"
            style={{
              width: rs(40),
              height: rs(40),
              borderRadius: rs(20),
              backgroundColor: colors.surface,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="settings-outline" size={rs(19)} color={colors.text} />
          </Pressable>
        </View>

        <View
          style={{
            flexDirection: "row",
            backgroundColor: colors.surface,
            borderRadius: radius.md + 2,
            padding: rs(3),
          }}
          accessibilityRole="tablist"
        >
          {TABS.map(([key, label]) => {
            const on = tab === key;
            const n = count(key);
            return (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: rs(6),
                  paddingVertical: spacing.sm + 2,
                  borderRadius: radius.md,
                  backgroundColor: on ? colors.background : "transparent",
                }}
              >
                <Text
                  style={{
                    color: on ? colors.text : colors.textMuted,
                    fontWeight: "700",
                  }}
                >
                  {label}
                </Text>
                {n ? (
                  <View
                    style={{
                      minWidth: rs(18),
                      height: rs(18),
                      paddingHorizontal: rs(5),
                      borderRadius: rs(9),
                      backgroundColor: colors.danger,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: colors.onImage,
                        fontSize: rf(11),
                        fontWeight: "800",
                      }}
                    >
                      {n}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: spacing.md,
          gap: spacing.lg,
        }}
      >
        {sections.length ? (
          sections.map(([title, list]) => (
            <View key={title} style={{ gap: spacing.xs }}>
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: rf(11),
                  fontWeight: "800",
                  letterSpacing: 1,
                  marginBottom: spacing.xs,
                }}
              >
                {title.toUpperCase()}
              </Text>
              {list.map((a) => (
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
                  // Clip the red strip to the card's rounded shape so it never peeks out at the corners.
                  containerStyle={{ borderRadius: radius.lg + 2, overflow: "hidden" }}
                >
                  <Pressable
                    onPress={() => open(a)}
                    onLongPress={() => more(a)}
                    accessibilityRole="button"
                    accessibilityLabel={`${a.read ? "" : "New. "}${a.title}. ${a.text}. ${ago(a.at, now)}`}
                    accessibilityHint="Swipe left or right to remove. Long press for more options"
                    accessibilityActions={[{ name: "remove", label: "Remove alert" }]}
                    onAccessibilityAction={(e) => e.nativeEvent.actionName === "remove" && removeAlert(a.id)}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      gap: spacing.md,
                      padding: spacing.md,
                      borderRadius: radius.lg + 2,
                      // Solid background so the red strip only shows where the alert has moved away.
                      // Pressed state changes colour, not opacity, so the strip behind never shows through.
                      backgroundColor: pressed ? colors.surface : a.read ? colors.background : colors.primarySurface,
                      borderWidth: a.read ? 1 : 0,
                      borderColor: colors.line,
                    })}
                  >
                    <AlertIcon alert={a} />
                    <View style={{ flex: 1, gap: rs(3) }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "flex-start",
                          gap: spacing.sm,
                        }}
                      >
                        <Text
                          style={{
                            flex: 1,
                            color: colors.text,
                            fontWeight: a.read ? "700" : "800",
                            fontSize: fontSize.md,
                          }}
                        >
                          {a.title}
                        </Text>
                        <Text
                          style={{
                            color: colors.textMuted,
                            fontSize: rf(12),
                            marginTop: 2,
                          }}
                        >
                          {ago(a.at, now)}
                        </Text>
                      </View>
                      <Text
                        style={{
                          color: colors.textMuted,
                          fontSize: fontSize.sm,
                          lineHeight: rf(19),
                        }}
                      >
                        {a.text}
                      </Text>
                      {pending(a) ? (
                        <View
                          style={{
                            flexDirection: "row",
                            gap: spacing.sm,
                            marginTop: spacing.sm,
                          }}
                        >
                          <SmallButton title="Accept" kind="green" onPress={() => accept(a)} />
                          <SmallButton title="Decline" onPress={() => decline(a)} />
                        </View>
                      ) : current(a) ? (
                        <View
                          style={{
                            flexDirection: "row",
                            gap: spacing.sm,
                            marginTop: spacing.sm,
                          }}
                        >
                          <SmallButton title="Track ride" kind="ink" onPress={() => go(a, "/coming")} />
                          <SmallButton title="Details" onPress={() => open(a)} />
                        </View>
                      ) : a.cta === "find" && now - a.at < DAY ? (
                        <View
                          style={{
                            flexDirection: "row",
                            marginTop: spacing.sm,
                          }}
                        >
                          <SmallButton title="Find another ride" kind="ink" onPress={() => go(a, "/results")} />
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                </Swipeable>
              ))}
            </View>
          ))
        ) : (
          <View
            style={{
              alignItems: "center",
              gap: spacing.sm,
              marginTop: spacing.xl * 2,
              paddingHorizontal: spacing.lg,
            }}
          >
            <View
              style={{
                width: rs(96),
                height: rs(96),
                borderRadius: rs(48),
                backgroundColor: colors.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="notifications-outline" size={rs(40)} color={colors.textMuted} />
            </View>
            <Text
              style={{
                color: colors.text,
                fontWeight: "800",
                fontSize: fontSize.lg - 2,
                marginTop: spacing.sm,
              }}
            >
              No alerts yet
            </Text>
            <Text
              style={{
                color: colors.textMuted,
                textAlign: "center",
                lineHeight: rf(20),
              }}
            >
              {tab === "requests" ? "When colleagues ask for a seat in your ride, you’ll see it here." : "Ride confirmations, changes and seat requests will show up here."}
            </Text>
          </View>
        )}
        {sections.length ? (
          <Text
            style={{
              color: colors.textMuted,
              fontSize: rf(12),
              textAlign: "center",
            }}
          >
            Swipe an alert left or right to remove it
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
