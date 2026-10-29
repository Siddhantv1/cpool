import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "../components/RideUI";
import { useTheme } from "../constants/theme";
import { goBack } from "../lib/nav";
import { searchRides } from "../lib/api";
import { OFFICES } from "../lib/mock";
import { bookRide, confirmWithdraw, myPickup, useTrips } from "../lib/trips";
import { useArea } from "../lib/useArea";
import { nearbyTimes } from "../lib/when";

const SORTS = [
  ["time", "Leaves first"],
  ["walk", "Shortest walk"],
];
const VEHICLES = [
  ["any", "Any"],
  ["car", "Car"],
  ["bike", "Bike"],
];
const DEFAULT_FILTERS = { sort: "time", vehicle: "any", helmet: false };
const metres = (text) => parseFloat(text) * (text.includes("km") ? 1000 : 1);
const minutes = (hhmm) => hhmm.split(":").reduce((h, m) => h * 60 + Number(m));

// Sort and filter the ride list (done on the phone; the list is short).
function applyFilters(hosts, { sort, vehicle, helmet }) {
  return hosts
    .filter((h) => vehicle === "any" || h.type === vehicle)
    .filter((h) => !helmet || h.helmet)
    .sort((a, b) => (sort === "walk" ? metres(a.walkTo) - metres(b.walkTo) : minutes(a.time) - minutes(b.time)));
}

function FilterSheet({ value, onDone, onClose }) {
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  const insets = useSafeAreaInsets();
  const [f, setF] = useState(value);
  const chip = (on, label, onPress) => (
    <Pressable
      key={label}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 2,
        borderRadius: radius.pill,
        borderWidth: 1.5,
        borderColor: on ? colors.ink : colors.line,
        backgroundColor: on ? colors.ink : colors.background,
      }}
    >
      <Text style={{ color: on ? colors.onInk : colors.text, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
  const label = (text) => <Text style={{ color: colors.textMuted, fontSize: rf(11), fontWeight: "800", letterSpacing: 1 }}>{text}</Text>;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.scrim }} onPress={onClose} accessibilityLabel="Close" />
      <View style={{ backgroundColor: colors.background, borderTopLeftRadius: rs(26), borderTopRightRadius: rs(26), padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg, gap: spacing.md }}>
        <View style={{ alignSelf: "center", width: rs(40), height: rs(4), borderRadius: rs(4), backgroundColor: colors.line }} />
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text accessibilityRole="header" style={{ flex: 1, color: colors.text, fontSize: fontSize.lg, fontWeight: "800" }}>
            Filters
          </Text>
          <Pressable onPress={() => setF(DEFAULT_FILTERS)} accessibilityRole="button" hitSlop={8}>
            <Text style={{ color: colors.primary, fontWeight: "700" }}>Reset</Text>
          </Pressable>
        </View>
        {label("SORT BY")}
        <View style={{ flexDirection: "row", gap: spacing.sm }}>{SORTS.map(([k, l]) => chip(f.sort === k, l, () => setF({ ...f, sort: k })))}</View>
        {label("VEHICLE")}
        <View style={{ flexDirection: "row", gap: spacing.sm }}>{VEHICLES.map(([k, l]) => chip(f.vehicle === k, l, () => setF({ ...f, vehicle: k })))}</View>
        {label("BIKE RIDES")}
        <View style={{ flexDirection: "row", gap: spacing.sm }}>{chip(f.helmet, "Spare helmet only", () => setF({ ...f, helmet: !f.helmet }))}</View>
        <Pressable onPress={() => onDone(f)} accessibilityRole="button" style={{ backgroundColor: colors.ink, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.sm }}>
          <Text style={{ color: colors.onInk, fontWeight: "800", fontSize: fontSize.md }}>Show rides</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function HostCard({ host, requested, onRequest, officeId }) {
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  const vehicleIcon = host.type === "bike" ? "motorbike" : "car";
  const leg = (icon, text, mc) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: rs(4) }}>
      {mc ? <MaterialCommunityIcons name={icon} size={rs(16)} color={colors.primary} /> : <MaterialCommunityIcons name="walk" size={rs(15)} color={colors.text} />}
      <Text style={{ color: mc ? colors.primary : colors.text, fontWeight: "700", fontSize: fontSize.sm }}>{text}</Text>
    </View>
  );

  return (
    <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg + 6, padding: spacing.md, gap: spacing.md, backgroundColor: colors.background }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <Avatar initials={host.initials} color={host.color} size={rs(46)} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: rs(5) }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md }}>{host.name}</Text>
            <Ionicons name="checkmark-circle" size={rs(15)} color={colors.primary} accessibilityLabel="Verified" />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: rs(4) }}>
            <MaterialCommunityIcons name={vehicleIcon} size={rs(14)} color={colors.primary} />
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }} numberOfLines={1}>
              {host.vehicle}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.lg }}>{host.time}</Text>
          <Text style={{ color: colors.textMuted, fontSize: rf(11) }}>leaves</Text>
        </View>
      </View>

      <Pressable
        onPress={() => router.push({ pathname: "/pickup-map", params: { id: host.id, office: officeId } })}
        accessibilityRole="button"
        accessibilityLabel={`Walk ${host.walkTo}, ride ${host.ride}, walk ${host.walkFrom}. Show pickup on map`}
        style={({ pressed }) => ({ borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.sm + 2, alignItems: "center", gap: spacing.sm, opacity: pressed ? 0.7 : 1 })}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          {leg("walk", host.walkTo)}
          <Ionicons name="chevron-forward" size={rs(12)} color={colors.textMuted} />
          {leg(vehicleIcon, host.ride, true)}
          <Ionicons name="chevron-forward" size={rs(12)} color={colors.textMuted} />
          {leg("walk", host.walkFrom)}
        </View>
        <View style={{ flexDirection: "row", gap: rs(6) }} accessibilityLabel={`${host.seatsFree} of ${host.seatsTotal} seats free`}>
          {Array.from({ length: host.seatsTotal }, (_, i) => (
            <View key={i} style={{ width: rs(26), height: rs(26), borderRadius: rs(13), backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", opacity: i < host.seatsFree ? 1 : 0.35 }}>
              <MaterialCommunityIcons name="seat-passenger" size={rs(14)} color={colors.text} />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: rs(4) }}>
          <Ionicons name="map-outline" size={rs(13)} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: rf(12), fontWeight: "700" }}>See pickup on map</Text>
        </View>
      </Pressable>

      {host.helmet ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: rs(6) }}>
          <MaterialCommunityIcons name="racing-helmet" size={rs(15)} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Carries a spare helmet</Text>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text style={{ color: host.full ? colors.green : colors.warning, fontWeight: "800", fontSize: fontSize.sm, flex: 1 }}>{host.match}</Text>
        <Pressable
          onPress={onRequest}
          accessibilityRole="button"
          accessibilityLabel={`Request a seat with ${host.name}`}
          style={({ pressed }) => ({
            backgroundColor: requested ? colors.surface : colors.green,
            borderRadius: radius.pill,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm + 2,
            opacity: pressed ? 0.85 : 1,
            flexDirection: "row",
            alignItems: "center",
            gap: rs(6),
          })}
        >
          {requested ? <ActivityIndicator size="small" color={colors.text} /> : null}
          <Text style={{ color: requested ? colors.text : colors.onGreen, fontWeight: "800" }}>{requested ? "Requested" : "Request"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Index in OFFICES of an office named in a place label ("Perficient Whitefield"), or -1.
const officeIndex = (name) => (name ? OFFICES.findIndex((o) => String(name).includes(o.short)) : -1);

export default function Results() {
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  const { to, when = "Tomorrow · 9:00 AM" } = useLocalSearchParams();
  const { booking, places, published } = useTrips();
  const area = useArea();
  const pickup = places.pickup?.name ?? "Current location";
  // Which end of the trip is an office: the drop (to office) or the pickup (from office to a place).
  const toIndex = officeIndex(to);
  const fromIndex = officeIndex(places.pickup?.name);
  const side = toIndex >= 0 || !to ? "to" : "from";
  // Office to office (Old → New): both ends are fixed, so there is no office tab to switch.
  const officeToOffice = toIndex >= 0 && fromIndex >= 0;
  const [office, setOffice] = useState(Math.max(0, side === "from" ? fromIndex : toIndex));
  const [found, setFound] = useState({ key: null, list: [] });
  const [notify, setNotify] = useState(false);
  const officeId = OFFICES[office].id;
  const hosts = found.key === String(officeId) ? found.list : null;
  const fromLabel = side === "from" ? OFFICES[office].name : pickup;
  const toLabel = side === "to" ? OFFICES[office].name : to;
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [filtering, setFiltering] = useState(false);
  const pending = booking?.status === "requested" ? booking.host.id : null;
  useEffect(() => {
    let alive = true;
    searchRides(officeId)
      .then((list) => alive && setFound({ key: String(officeId), list }))
      .catch(() => alive && setFound({ key: String(officeId), list: [] }));
    return () => {
      alive = false;
    };
  }, [officeId]);
  const shown = hosts && applyFilters(hosts, filters);
  const active = (filters.vehicle !== "any") + filters.helmet + (filters.sort !== "time");

  function request(hostId) {
    if (pending === hostId) return router.push("/requested");
    if (published) return Alert.alert("You’re hosting a ride", "Finish or cancel your published ride before booking a seat.");
    const first = booking?.host.name.split(" ")[0];
    if (booking?.status === "requested") {
      return Alert.alert(`You’ve already asked ${first}`, "You can have one seat request at a time. Withdraw it to ask someone else.", [
        { text: "Close", style: "cancel" },
        { text: "View request", onPress: () => router.push("/requested") },
        { text: "Withdraw", style: "destructive", onPress: () => confirmWithdraw() },
      ]);
    }
    if (booking?.status === "accepted") {
      return Alert.alert(`You’re riding with ${first}`, "Cancel that ride first if you want to book a different one.", [
        { text: "Close", style: "cancel" },
        { text: "View ride", onPress: () => router.push("/accepted") },
      ]);
    }
    bookRide(hostId, side === "to" ? OFFICES[office] : OFFICES[0], myPickup(area));
    router.push("/requested");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={{ width: rs(38), height: rs(38), borderRadius: radius.md + 2, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="chevron-back" size={rs(20)} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: "800" }}>
            {!shown ? "Finding rides…" : hosts.length ? `${shown.length} ride${shown.length === 1 ? "" : "s"} available` : "No rides yet"}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: rf(12) }} numberOfLines={1}>
            {when}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: rf(12) }} numberOfLines={1} accessibilityLabel={`From ${fromLabel} to ${toLabel}`}>
            {fromLabel} → {toLabel}
          </Text>
        </View>
        <Pressable
          onPress={() => setFiltering(true)}
          accessibilityRole="button"
          accessibilityLabel={active ? `Filters, ${active} on` : "Filters"}
          style={{ width: rs(38), height: rs(38), borderRadius: radius.md + 2, backgroundColor: active ? colors.ink : colors.surface, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="options-outline" size={rs(19)} color={active ? colors.onInk : colors.text} />
          {active ? (
            <View style={{ position: "absolute", top: -rs(4), right: -rs(4), minWidth: rs(18), height: rs(18), borderRadius: rs(9), backgroundColor: colors.green, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: colors.onGreen, fontSize: rf(11), fontWeight: "800" }}>{active}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        {!officeToOffice ? <Text style={{ color: colors.textMuted, fontSize: rf(11), fontWeight: "800", letterSpacing: 1 }}>{side === "to" ? "GOING TO" : "LEAVING FROM"}</Text> : null}
        {!officeToOffice ? (
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: -spacing.sm }} accessibilityRole="tablist">
            {OFFICES.map((o, i) => (
              <Pressable
                key={o.id}
                onPress={() => {
                  setOffice(i);
                  setNotify(false);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: office === i }}
                style={{ flex: 1, alignItems: "center", paddingVertical: spacing.sm + 2, borderRadius: radius.md + 2, backgroundColor: office === i ? colors.ink : colors.surface }}
              >
                <Text style={{ color: office === i ? colors.onInk : colors.textMuted, fontWeight: "700", fontSize: fontSize.sm }}>
                  {o.short} · {o.tag.split(" ")[0]}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {hosts === null ? <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.text} /> : shown.map((h) => <HostCard key={h.id} host={h} requested={pending === h.id} onRequest={() => request(h.id)} officeId={officeId} />)}
        {hosts && !hosts.length ? (
          <View style={{ alignItems: "center", gap: spacing.md, marginTop: spacing.xl * 2, paddingHorizontal: spacing.md }}>
            <View style={{ width: rs(96), height: rs(96), borderRadius: rs(48), backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="time-outline" size={rs(44)} color={colors.textMuted} />
            </View>
            <Text accessibilityRole="header" style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.lg - 2, textAlign: "center" }}>
              No one is driving at {when.split(" · ").pop()} yet
            </Text>
            <Text style={{ color: colors.textMuted, textAlign: "center", lineHeight: rf(21) }}>Try a nearby time, or the other office. We can also alert you as soon as a ride is published.</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.sm }}>
              {nearbyTimes(when).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => {
                    router.setParams({ when: t });
                    setNotify(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Search ${t}`}
                  style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700" }}>{t.split(" · ").pop()}</Text>
                </Pressable>
              ))}
            </View>
            {/* shortcut: only remembered on this screen; the backend sends the push when a matching ride is published. */}
            <Pressable
              onPress={() => setNotify(true)}
              disabled={notify}
              accessibilityRole="button"
              accessibilityState={{ disabled: notify }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                backgroundColor: notify ? colors.greenSurface : colors.ink,
                borderRadius: radius.lg,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md - 2,
              }}
            >
              {notify ? <Ionicons name="checkmark-circle" size={rs(18)} color={colors.green} /> : null}
              <Text style={{ color: notify ? colors.green : colors.onInk, fontWeight: "800" }} accessibilityLiveRegion="polite">
                {notify ? "We’ll notify you" : "Notify me about this trip"}
              </Text>
            </Pressable>
          </View>
        ) : null}
        {hosts?.length > 0 && !shown.length ? (
          <View style={{ alignItems: "center", gap: spacing.sm, marginTop: spacing.xl }}>
            <Ionicons name="funnel-outline" size={rs(32)} color={colors.textMuted} />
            <Text style={{ color: colors.text, fontWeight: "700" }}>No rides match your filters</Text>
            <Pressable onPress={() => setFilters(DEFAULT_FILTERS)} accessibilityRole="button">
              <Text style={{ color: colors.primary, fontWeight: "700" }}>Clear filters</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
      {filtering ? (
        <FilterSheet
          value={filters}
          onClose={() => setFiltering(false)}
          onDone={(f) => {
            setFilters(f);
            setFiltering(false);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}
