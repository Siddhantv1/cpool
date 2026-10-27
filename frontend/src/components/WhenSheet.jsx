import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../constants/theme";
import { dayLabel, nextDays, timeLabel } from "../lib/when";

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const ROW = 44;

// One scrolling column of the time picker (hour, minute or AM/PM).
function Column({ items, value, onChange, format, label }) {
  const { colors, radius } = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, height: ROW * 5 }}
      contentOffset={{ x: 0, y: Math.max(0, items.indexOf(value) - 2) * ROW }}
      showsVerticalScrollIndicator={false}
      accessibilityLabel={label}
      nestedScrollEnabled
    >
      {items.map((item) => {
        const on = item === value;
        return (
          <Pressable
            key={item}
            onPress={() => onChange(item)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${label} ${format(item)}`}
            style={{ height: ROW, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: on ? colors.ink : "transparent" }}
          >
            <Text style={{ color: on ? colors.onInk : colors.text, fontSize: 18, fontWeight: on ? "800" : "500" }}>{format(item)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// Bottom sheet to pick the day and exact time (any minute). value: Date; onDone(Date).
export default function WhenSheet({ visible, value, onDone, onClose, title = "When are you leaving?" }) {
  const { colors, spacing, fontSize, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const days = nextDays();
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  const [day, setDay] = useState(() => days.find((d) => sameDay(d, value)) ?? days[1]);
  const [hour, setHour] = useState(value.getHours() % 12 || 12);
  const [minute, setMinute] = useState(value.getMinutes());
  const [pm, setPm] = useState(value.getHours() >= 12);

  const picked = new Date(day.getFullYear(), day.getMonth(), day.getDate(), (hour % 12) + (pm ? 12 : 0), minute);
  // Rides need at least 10 minutes' notice so colleagues can still request a seat.
  const tooSoon = picked - new Date() < 10 * 60 * 1000;
  const nice = ["Today", "Tomorrow"].includes(dayLabel(picked)) ? dayLabel(picked).toLowerCase() : `on ${dayLabel(picked)}`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.scrim }} onPress={onClose} accessibilityLabel="Close" />
      <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: spacing.md, paddingBottom: insets.bottom + spacing.md, gap: spacing.md }}>
        <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 4, backgroundColor: colors.line }} />
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
                style={{ height: 42, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1.5, borderColor: on ? colors.ink : colors.line, backgroundColor: on ? colors.ink : colors.background }}
              >
                <Text style={{ color: on ? colors.onInk : colors.text, fontWeight: "700" }}>{dayLabel(d)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ flexDirection: "row", gap: spacing.sm, marginHorizontal: spacing.lg, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface }}>
          <Column label="Hour" items={HOURS} value={hour} onChange={setHour} format={String} />
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800", alignSelf: "center" }}>:</Text>
          <Column label="Minute" items={MINUTES} value={minute} onChange={setMinute} format={(m) => String(m).padStart(2, "0")} />
          <Column label="AM or PM" items={[false, true]} value={pm} onChange={setPm} format={(p) => (p ? "PM" : "AM")} />
        </View>

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
            style={{ backgroundColor: tooSoon ? colors.disabled : colors.ink, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: "center" }}
          >
            <Text style={{ color: colors.onInk, fontWeight: "800", fontSize: fontSize.md }}>{`Leave ${nice} at ${timeLabel(picked)}`}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
