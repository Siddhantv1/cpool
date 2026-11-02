import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../constants/theme";
import { dayLabel, nextDays, timeLabel } from "../lib/when";

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const two = (n) => String(n).padStart(2, "0");
const ease = Easing.out(Easing.cubic);
// The short way round: from 330° to 0° turns +30°, not -330°.
const shortest = (from, to) => from + ((((to - from) % 360) + 540) % 360) - 180;

// A big number at the top that rolls up (or down) to its new value. order: where the value sits on the clock.
function Roll({ text, order, still, height, style }) {
  const [shown, setShown] = useState({ text, order });
  const [prev, setPrev] = useState(null);
  const [y] = useState(() => new Animated.Value(1));
  if (text !== shown.text) {
    setPrev(shown);
    setShown({ text, order });
  }
  useEffect(() => {
    if (!prev) return;
    y.setValue(0);
    const run = Animated.timing(y, { toValue: 1, duration: still ? 0 : 240, easing: ease, useNativeDriver: true });
    run.start(({ finished }) => finished && setPrev(null));
    return () => run.stop();
  }, [prev, still, y]);
  const dir = prev && shown.order < prev.order ? -1 : 1;
  const slide = (from, to) => ({ position: "absolute", left: 0, right: 0, transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [from, to] }) }] });
  return (
    <View style={{ height, overflow: "hidden" }}>
      {prev ? <Animated.Text style={[style, slide(0, -dir * height)]}>{prev.text}</Animated.Text> : null}
      <Animated.Text style={[style, prev ? slide(dir * height, 0) : null]}>{shown.text}</Animated.Text>
    </View>
  );
}

// Clock face: 12 numbers round a circle and a hand with a blue circle at its tip. Tap a number, or drag a finger
// round the clock and the hand follows, snapping to each number. onPick(item, live): live while the finger moves.
function Dial({ items, value, onPick, onRelease, format, label, still }) {
  const { colors, rs, rf } = useTheme();
  const size = rs(230);
  const dot = rs(40);
  const r = size / 2 - dot / 2 - rs(6);
  const index = items.indexOf(value);
  const [turn] = useState(() => new Animated.Value(index * 30));
  const [fade] = useState(() => new Animated.Value(1));
  // The number shown white: it changes when the blue circle arrives under it, not before.
  const [lit, setLit] = useState(`${label}${value}`);
  const angle = useRef(index * 30);
  const dragging = useRef(false);
  const face = useRef(null);
  const centre = useRef(null);
  const start = useRef(null);

  // The hand sweeps the short way round to the picked number (quickly while dragging).
  useEffect(() => {
    angle.current = shortest(angle.current, index * 30);
    const run = Animated.timing(turn, { toValue: angle.current, duration: still ? 0 : dragging.current ? 90 : 300, easing: ease, useNativeDriver: true });
    run.start(({ finished }) => finished && setLit(`${label}${value}`));
    return () => run.stop();
  }, [index, label, value, still, turn]);

  // Switching between hours and minutes: the new numbers fade and grow in.
  useEffect(() => {
    if (still) return;
    fade.setValue(0);
    const run = Animated.timing(fade, { toValue: 1, duration: 260, easing: ease, useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [label, still, fade]);

  // A plain tap goes to the number buttons; once the finger moves, the dial takes over and the hand follows it.
  const follow = (e) => {
    const c = centre.current;
    if (!c) return;
    const dx = e.nativeEvent.pageX - c.x;
    const dy = e.nativeEvent.pageY - c.y;
    if (Math.hypot(dx, dy) < c.w * 0.12) return; // too close to the middle to tell the direction
    const deg = (Math.atan2(dx, -dy) * 180) / Math.PI + 360;
    onPick(items[Math.round(deg / 30) % 12], true);
  };
  const drag = {
    onTouchStart: (e) => (start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY }),
    onMoveShouldSetResponderCapture: (e) => !!start.current && Math.hypot(e.nativeEvent.pageX - start.current.x, e.nativeEvent.pageY - start.current.y) > 6,
    onResponderTerminationRequest: () => false,
    onResponderGrant: () => {
      dragging.current = true;
      face.current?.measure((x, y, w, h, px, py) => (centre.current = { x: px + w / 2, y: py + h / 2, w }));
    },
    onResponderMove: follow,
    onResponderRelease: () => {
      dragging.current = false;
      onRelease?.();
    },
    onResponderTerminate: () => {
      dragging.current = false;
    },
  };

  const rotate = turn.interpolate({ inputRange: [0, 360], outputRange: ["0deg", "360deg"] });
  return (
    <View ref={face} {...drag} style={{ alignSelf: "center", width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface }}>
      {/* The hand: a full-size layer turned around the dial's centre, a line from the centre up to the blue circle. */}
      <Animated.View pointerEvents="none" style={{ position: "absolute", width: size, height: size, alignItems: "center", transform: [{ rotate }] }}>
        <View style={{ position: "absolute", top: size / 2 - r, width: 2, height: r, backgroundColor: colors.primary }} />
        <View style={{ position: "absolute", top: size / 2 - r - dot / 2, width: dot, height: dot, borderRadius: dot / 2, backgroundColor: colors.primary }} />
      </Animated.View>
      <View pointerEvents="none" style={{ position: "absolute", left: size / 2 - rs(4), top: size / 2 - rs(4), width: rs(8), height: rs(8), borderRadius: rs(4), backgroundColor: colors.primary }} />
      <Animated.View style={{ position: "absolute", width: size, height: size, opacity: fade, transform: [{ scale: fade.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }}>
        {items.map((item, i) => {
          const a = (i / 12) * 2 * Math.PI;
          const on = lit === `${label}${item}`;
          return (
            <Pressable
              key={item}
              onPress={() => onPick(item, false)}
              accessibilityRole="button"
              accessibilityState={{ selected: item === value }}
              accessibilityLabel={`${label} ${format(item)}`}
              style={{ position: "absolute", left: size / 2 + r * Math.sin(a) - dot / 2, top: size / 2 - r * Math.cos(a) - dot / 2, width: dot, height: dot, borderRadius: dot / 2, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: on ? colors.onPrimary : colors.text, fontSize: rf(15), fontWeight: on ? "800" : "600" }}>{format(item)}</Text>
            </Pressable>
          );
        })}
      </Animated.View>
    </View>
  );
}

// Bottom sheet to pick the day and time: day chips, then a clock dial (hour first, then minutes). value: Date; onDone(Date).
export default function WhenSheet({ visible, value, onDone, onClose, title = "When are you leaving?" }) {
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  const insets = useSafeAreaInsets();
  const days = nextDays();
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  const [day, setDay] = useState(() => days.find((d) => sameDay(d, value)) ?? days[1]);
  const [hour, setHour] = useState(value.getHours() % 12 || 12);
  const [minute, setMinute] = useState(value.getMinutes());
  const [pm, setPm] = useState(value.getHours() >= 12);
  const [mode, setMode] = useState("hour");
  // No motion if the phone asks for less of it (Settings → Remove animations).
  const [still, setStill] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setStill);
  }, []);

  // One light-blue highlight that slides between hour and minute, and one between AM and PM.
  const [modeSlide] = useState(() => new Animated.Value(0));
  const [pmSlide] = useState(() => new Animated.Value(pm ? 1 : 0));
  const [spots, setSpots] = useState({ minute: 0, pm: 0 });
  useEffect(() => {
    Animated.timing(modeSlide, { toValue: mode === "minute" ? 1 : 0, duration: still ? 0 : 280, easing: ease, useNativeDriver: true }).start();
  }, [mode, still, modeSlide]);
  useEffect(() => {
    Animated.timing(pmSlide, { toValue: pm ? 1 : 0, duration: still ? 0 : 280, easing: ease, useNativeDriver: true }).start();
  }, [pm, still, pmSlide]);

  const picked = new Date(day.getFullYear(), day.getMonth(), day.getDate(), (hour % 12) + (pm ? 12 : 0), minute);
  // Rides need at least 10 minutes' notice so colleagues can still request a seat.
  const tooSoon = picked - new Date() < 10 * 60 * 1000;
  const nice = ["Today", "Tomorrow"].includes(dayLabel(picked)) ? dayLabel(picked).toLowerCase() : `on ${dayLabel(picked)}`;
  // After an hour is picked, wait for the hand to arrive, then move on to minutes.
  const toMinutes = (wait) => setTimeout(() => setMode("minute"), still ? 0 : wait);

  const boxW = rs(76);
  const boxH = rs(56);
  // The big hour / minute boxes at the top; the one being changed is highlighted.
  const box = (key, text, order) => {
    const on = mode === key;
    return (
      <Pressable
        onPress={() => setMode(key)}
        onLayout={key === "minute" ? (e) => setSpots((s) => ({ ...s, minute: e.nativeEvent.layout.x })) : undefined}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={`${key === "hour" ? "Hour" : "Minute"} ${text}. Tap to change`}
        style={{ width: boxW, height: boxH, borderRadius: radius.md }}
      >
        <Roll text={text} order={order} still={still} height={boxH} style={{ color: on ? colors.primary : colors.text, fontSize: rf(40), lineHeight: boxH, fontWeight: "800", textAlign: "center" }} />
      </Pressable>
    );
  };
  const pillW = rs(46);
  const pillH = rs(28);
  const ampm = (isPm) => {
    const on = pm === isPm;
    return (
      <Pressable
        onPress={() => setPm(isPm)}
        onLayout={isPm ? (e) => setSpots((s) => ({ ...s, pm: e.nativeEvent.layout.y })) : undefined}
        accessibilityRole="radio"
        accessibilityState={{ checked: on }}
        style={{ width: pillW, height: pillH, borderRadius: radius.md, alignItems: "center", justifyContent: "center" }}
      >
        <Text style={{ color: on ? colors.primary : colors.text, fontSize: rf(15), fontWeight: "800" }}>{isPm ? "PM" : "AM"}</Text>
      </Pressable>
    );
  };
  const highlight = (w, h, transform) => (
    <Animated.View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: w, height: h, borderRadius: radius.md, backgroundColor: colors.primarySurface, transform }} />
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.scrim }} onPress={onClose} accessibilityLabel="Close" />
      <View style={{ backgroundColor: colors.background, borderTopLeftRadius: rs(26), borderTopRightRadius: rs(26), paddingTop: spacing.md, paddingBottom: insets.bottom + spacing.md, gap: spacing.md }}>
        <View style={{ alignSelf: "center", width: rs(40), height: rs(4), borderRadius: rs(4), backgroundColor: colors.line }} />
        <Text accessibilityRole="header" style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: "800", paddingHorizontal: spacing.lg }}>{title}</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}>
          {days.map((d) => {
            const on = sameDay(d, day);
            return (
              <Pressable
                key={d.toDateString()}
                onPress={() => setDay(d)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={{ height: rs(42), justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1.5, borderColor: on ? colors.ink : colors.line, backgroundColor: on ? colors.ink : colors.background }}
              >
                <Text style={{ color: on ? colors.onInk : colors.text, fontWeight: "700" }}>{dayLabel(d)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            {highlight(boxW, boxH, [{ translateX: modeSlide.interpolate({ inputRange: [0, 1], outputRange: [0, spots.minute] }) }])}
            {box("hour", String(hour), hour % 12)}
            <Text style={{ color: colors.text, fontSize: rf(36), fontWeight: "800" }}>:</Text>
            {box("minute", two(minute), minute)}
          </View>
          <View style={{ marginLeft: spacing.sm, gap: rs(2) }}>
            {highlight(pillW, pillH, [{ translateY: pmSlide.interpolate({ inputRange: [0, 1], outputRange: [0, spots.pm] }) }])}
            {ampm(false)}
            {ampm(true)}
          </View>
        </View>

        {mode === "hour" ? (
          <Dial
            label="Hour"
            items={HOURS}
            value={hour}
            format={String}
            still={still}
            onPick={(h, live) => {
              setHour(h);
              if (!live) toMinutes(420);
            }}
            onRelease={() => toMinutes(260)}
          />
        ) : (
          <Dial label="Minute" items={MINUTES} value={minute} format={two} still={still} onPick={setMinute} />
        )}

        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          {tooSoon ? (
            <Text style={{ color: colors.error, fontSize: fontSize.sm }} accessibilityLiveRegion="polite">
              Pick a time at least 10 minutes from now.
            </Text>
          ) : null}
          <Pressable
            onPress={() => onDone(picked)}
            disabled={tooSoon}
            accessibilityRole="button"
            accessibilityState={{ disabled: tooSoon }}
            style={{ backgroundColor: tooSoon ? colors.disabled : colors.ink, borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: "center" }}
          >
            <Text style={{ color: colors.onInk, fontWeight: "800", fontSize: fontSize.md }}>{`Leave ${nice} at ${timeLabel(picked)}`}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
