import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../constants/theme";
import { dayLabel, nextDays, timeLabel } from "../lib/when";

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const two = (n) => String(n).padStart(2, "0");

// Clock face: 12 numbers round a circle and a hand pointing at the current one. Tap a number to pick it.
function Dial({ items, value, angle, onPick, format, label }) {
  const { colors, rs, rf } = useTheme();
  const size = rs(230);
  const dot = rs(40);
  const r = size / 2 - dot / 2 - rs(6);
  return (
    <View style={{ alignSelf: "center", width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface }}>
      {/* The hand: a full-size layer turned around the dial's centre, with a line from the centre up to the numbers. */}
      <View pointerEvents="none" style={{ position: "absolute", width: size, height: size, alignItems: "center", transform: [{ rotate: `${angle}deg` }] }}>
        <View style={{ position: "absolute", top: size / 2 - r, width: 2, height: r, backgroundColor: colors.primary }} />
      </View>
      <View pointerEvents="none" style={{ position: "absolute", left: size / 2 - rs(4), top: size / 2 - rs(4), width: rs(8), height: rs(8), borderRadius: rs(4), backgroundColor: colors.primary }} />
      {items.map((item, i) => {
        const a = (i / 12) * 2 * Math.PI;
        const on = item === value;
        return (
          <Pressable
            key={item}
            onPress={() => onPick(item)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${label} ${format(item)}`}
            style={{ position: "absolute", left: size / 2 + r * Math.sin(a) - dot / 2, top: size / 2 - r * Math.cos(a) - dot / 2, width: dot, height: dot, borderRadius: dot / 2, alignItems: "center", justifyContent: "center", backgroundColor: on ? colors.primary : "transparent" }}
          >
            <Text style={{ color: on ? colors.onPrimary : colors.text, fontSize: rf(15), fontWeight: on ? "800" : "600" }}>{format(item)}</Text>
          </Pressable>
        );
      })}
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

  const picked = new Date(day.getFullYear(), day.getMonth(), day.getDate(), (hour % 12) + (pm ? 12 : 0), minute);
  // Rides need at least 10 minutes' notice so colleagues can still request a seat.
  const tooSoon = picked - new Date() < 10 * 60 * 1000;
  const nice = ["Today", "Tomorrow"].includes(dayLabel(picked)) ? dayLabel(picked).toLowerCase() : `on ${dayLabel(picked)}`;

  // The big hour / minute boxes at the top; the one being changed is highlighted.
  const box = (key, text) => {
    const on = mode === key;
    return (
      <Pressable
        onPress={() => setMode(key)}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={`${key === "hour" ? "Hour" : "Minute"} ${text}. Tap to change`}
        style={{ minWidth: rs(72), paddingHorizontal: spacing.sm, paddingVertical: rs(4), borderRadius: radius.md, alignItems: "center", backgroundColor: on ? colors.primarySurface : "transparent" }}
      >
        <Text style={{ color: on ? colors.primary : colors.text, fontSize: rf(40), fontWeight: "800" }}>{text}</Text>
      </Pressable>
    );
  };
  const ampm = (isPm) => {
    const on = pm === isPm;
    return (
      <Pressable
        onPress={() => setPm(isPm)}
        accessibilityRole="radio"
        accessibilityState={{ checked: on }}
        style={{ paddingHorizontal: spacing.sm, paddingVertical: rs(4), borderRadius: radius.md, backgroundColor: on ? colors.primarySurface : "transparent" }}
      >
        <Text style={{ color: on ? colors.primary : colors.text, fontSize: rf(15), fontWeight: "800" }}>{isPm ? "PM" : "AM"}</Text>
      </Pressable>
    );
  };

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
          {box("hour", String(hour))}
          <Text style={{ color: colors.text, fontSize: rf(36), fontWeight: "800" }}>:</Text>
          {box("minute", two(minute))}
          <View style={{ marginLeft: spacing.sm, gap: rs(2) }}>
            {ampm(false)}
            {ampm(true)}
          </View>
        </View>

        {mode === "hour" ? (
          <Dial
            label="Hour"
            items={HOURS}
            value={hour}
            angle={(hour % 12) * 30}
            format={String}
            onPick={(h) => {
              setHour(h);
              setMode("minute");
            }}
          />
        ) : (
          <Dial label="Minute" items={MINUTES} value={minute} angle={minute * 6} format={two} onPick={setMinute} />
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
