import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import WhenSheet from "../components/WhenSheet";
import { Avatar, RequestStatus, TripLegs } from "../components/RideUI";
import { useTheme } from "../constants/theme";
import { goBack } from "../lib/nav";
import { searchRides } from "../lib/api";
import { OFFICES } from "../lib/mock";
import { ampm, pickupWindow, requestSeat, useOpenRideWhenAccepted } from "../lib/requestSeat";
import { confirmWithdraw, myPickup, useTrips } from "../lib/trips";
import { useArea } from "../lib/useArea";
import { defaultWhen, nearbyTimes, whenLabel } from "../lib/when";

const SORTS = [
  ["time", "Earliest first"],
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

function HostCard({ host, pending, onRequest, onMap }) {
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  const first = host.name.split(" ")[0];
  const bike = host.type === "bike";
  // Corner tab: a spare helmet (purple), no spare helmet (amber), or just the vehicle type.
  const corner = bike ? (host.helmet ? { bg: colors.purpleSurface, fg: colors.purple, text: "Helmet", icon: "racing-helmet" } : { bg: colors.warningSurface, fg: colors.warning, text: "No helmet", icon: "racing-helmet" }) : { bg: colors.primarySurface, fg: colors.primary, icon: "car" };
  return (
    <View style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.cardLine, borderRadius: rs(22), overflow: "hidden", elevation: 1, shadowColor: "#0F172A", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
      <View
        accessibilityLabel={bike ? (host.helmet ? "Carries a spare helmet" : "No spare helmet") : "Car"}
        style={{ position: "absolute", right: 0, top: 0, height: rs(32), paddingHorizontal: spacing.sm + 6, borderBottomLeftRadius: rs(16), backgroundColor: corner.bg, flexDirection: "row", alignItems: "center", gap: rs(5) }}
      >
        <MaterialCommunityIcons name={corner.icon} size={rs(17)} color={corner.fg} />
        {corner.text ? <Text style={{ color: corner.fg, fontWeight: "700", fontSize: rf(13) }}>{corner.text}</Text> : null}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md - 2, padding: spacing.md, paddingBottom: spacing.sm + 6 }}>
        <View style={{ padding: 3, borderRadius: rs(40), backgroundColor: colors.background, borderWidth: 1, borderColor: colors.line }}>
          <Avatar initials={host.initials} gender={host.gender} color={host.color} size={rs(62)} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: rs(3), paddingRight: rs(28) }}>
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: rf(17.5) }} numberOfLines={1}>
            {host.name}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: rs(5) }}>
            <Text style={{ color: colors.textMuted, fontSize: rf(14), flexShrink: 1 }} numberOfLines={1}>
              {host.vehicle}
            </Text>
            <MaterialCommunityIcons name="check-decagram" size={rs(17)} color={colors.green} accessibilityLabel="Verified" />
          </View>
          <Text style={{ color: colors.textMuted, fontSize: rf(14) }} numberOfLines={1}>
            Pickup by <Text style={{ color: colors.text, fontWeight: "600" }}>{pickupWindow(host.time)}</Text>
          </Text>
          <Pressable onPress={onMap} accessibilityRole="button" accessibilityLabel={`See ${first}’s pickup and drop on the map`} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: rs(4), alignSelf: "flex-start", marginTop: rs(2) }}>
            <Ionicons name="location-outline" size={rs(16)} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: rf(13.5) }}>See on map</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing.md }}>
        <TripLegs host={host} />
      </View>

      <View style={{ padding: spacing.md }}>
        {pending ? (
          <RequestStatus name={first} onCancel={() => confirmWithdraw()} />
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
            <View style={{ gap: rs(2) }}>
              <Text style={{ color: colors.primary }}>
                <Text style={{ fontSize: rf(24), fontWeight: "800" }}>{host.time}</Text>
                <Text style={{ fontSize: rf(13), fontWeight: "700" }}> {ampm(host.time)}</Text>
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: rf(13.5), fontWeight: "500" }}>
                {host.seatsFree} seat{host.seatsFree === 1 ? "" : "s"} left
              </Text>
            </View>
            <Pressable
              onPress={onRequest}
              accessibilityRole="button"
              accessibilityLabel={`Request a seat with ${first}`}
              style={({ pressed }) => ({
                height: rs(50),
                paddingHorizontal: spacing.lg,
                justifyContent: "center",
                borderRadius: radius.lg,
                backgroundColor: colors.primary,
                borderBottomWidth: pressed ? 2 : 4,
                borderBottomColor: colors.primaryEdge,
                transform: [{ translateY: pressed ? 2 : 0 }],
              })}
            >
              <Text style={{ color: colors.onPrimary, fontWeight: "700", fontSize: fontSize.md }}>Request Ride</Text>
            </Pressable>
          </View>
        )}
      </View>

      {bike ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginHorizontal: spacing.md, marginBottom: spacing.md, marginTop: -rs(4), padding: spacing.sm + 2, borderRadius: radius.md + 2, backgroundColor: host.helmet ? colors.purpleSurface : colors.warningSurface }}>
          <MaterialCommunityIcons name="racing-helmet" size={rs(18)} color={host.helmet ? colors.purple : colors.warning} />
          <Text style={{ flex: 1, color: host.helmet ? colors.purple : colors.warning, fontSize: rf(13), fontWeight: "500" }}>
            {host.helmet ? `${first} carries a spare helmet for you.` : `Bring your own helmet. ${first} doesn’t carry a spare.`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// Index in OFFICES of an office named in a place label ("Perficient Whitefield"), or -1.
const officeIndex = (name) => (name ? OFFICES.findIndex((o) => String(name).includes(o.short)) : -1);

export default function Results() {
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  const { to, when = "Tomorrow · 9:00 AM" } = useLocalSearchParams();
  const { booking, places } = useTrips();
  const area = useArea();
  useOpenRideWhenAccepted();
  const pickup = places.pickup?.name ?? "Current location";
  // Which end of the trip is an office: the drop (to office) or the pickup (from office to a place).
  const toIndex = officeIndex(to);
  const fromIndex = officeIndex(places.pickup?.name);
  const side = toIndex >= 0 || !to ? "to" : "from";
  // Office to office (Old → New): both ends are fixed, so there is no office to switch.
  const officeToOffice = toIndex >= 0 && fromIndex >= 0;
  const [office, setOffice] = useState(Math.max(0, side === "from" ? fromIndex : toIndex));
  const [found, setFound] = useState({ key: null, list: [] });
  const [notify, setNotify] = useState(false);
  const [picking, setPicking] = useState(null); // "office" menu | "time" sheet
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
  const carOnly = filters.vehicle === "car";
  const [whenDay, whenTime] = when.includes(" · ") ? when.split(" · ") : [when, ""];

  const request = (hostId) => requestSeat(hostId, side === "to" ? OFFICES[office] : OFFICES[0], myPickup(area));
  const openMap = (hostId) => router.push({ pathname: "/pickup-map", params: { id: hostId, office: officeId, when } });
  const officeLabel = (label, isOffice) => (
    <Pressable
      disabled={!isOffice || officeToOffice}
      onPress={() => setPicking("office")}
      accessibilityRole="button"
      accessibilityLabel={isOffice && !officeToOffice ? `${label}. Change office` : label}
      style={{ flexDirection: "row", alignItems: "center", gap: rs(2), flexShrink: 1 }}
    >
      <Text style={{ color: colors.textMuted, fontSize: rf(13.5), flexShrink: 1 }} numberOfLines={1}>
        {label}
      </Text>
      {isOffice && !officeToOffice ? <Ionicons name="chevron-down" size={rs(14)} color={colors.textMuted} /> : null}
    </Pressable>
  );

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header: route (tap the office to switch), date pill (opens the time picker), Car only. */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingLeft: rs(2), paddingRight: spacing.sm + 4, paddingTop: spacing.xs, paddingBottom: spacing.md - 2, backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.line, elevation: 3, shadowColor: "#0F172A", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, zIndex: 2 }}>
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={6} style={{ width: rs(40), height: rs(44), alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-back" size={rs(26)} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0, gap: rs(7) }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: rs(5) }} accessibilityLabel={`From ${fromLabel} to ${toLabel}`}>
            {officeLabel(fromLabel, side === "from")}
            <Ionicons name="arrow-forward" size={rs(14)} color={colors.textMuted} />
            {officeLabel(toLabel, side === "to")}
          </View>
          <Pressable
            onPress={() => setPicking("time")}
            accessibilityRole="button"
            accessibilityLabel={`${when}. Change time`}
            style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: spacing.sm, height: rs(34), paddingLeft: rs(4), paddingRight: rs(8), borderRadius: radius.md + 2, backgroundColor: colors.primarySurface }}
          >
            <View style={{ width: rs(26), height: rs(26), borderRadius: rs(8), backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="calendar-outline" size={rs(15)} color={colors.primary} />
            </View>
            <Text style={{ color: colors.text, fontSize: rf(14) }} numberOfLines={1}>
              <Text style={{ fontWeight: "700" }}>{whenDay}</Text>
              {whenTime ? <Text style={{ color: colors.textMuted }}> · </Text> : null}
              {whenTime}
            </Text>
            <Ionicons name="chevron-down" size={rs(16)} color={colors.primary} />
          </Pressable>
        </View>
        <View style={{ width: 1, alignSelf: "stretch", marginHorizontal: spacing.sm, backgroundColor: colors.line }} />
        <View style={{ alignItems: "center", gap: rs(7) }}>
          <Text style={{ color: colors.textMuted, fontSize: rf(12), fontWeight: "500" }}>Car only</Text>
          <Pressable
            onPress={() => setFilters({ ...filters, vehicle: carOnly ? "any" : "car" })}
            accessibilityRole="switch"
            accessibilityLabel="Car only"
            accessibilityState={{ checked: carOnly }}
            style={{ width: rs(48), height: rs(28), borderRadius: rs(14), padding: 2, justifyContent: "center", backgroundColor: carOnly ? colors.primary : colors.line }}
          >
            <View style={{ width: rs(24), height: rs(24), borderRadius: rs(12), alignSelf: carOnly ? "flex-end" : "flex-start", backgroundColor: carOnly ? colors.background : colors.text, alignItems: "center", justifyContent: "center" }}>
              <MaterialCommunityIcons name="car" size={rs(14)} color={carOnly ? colors.primary : colors.background} />
            </View>
          </Pressable>
        </View>
      </View>

      <ScrollView style={{ backgroundColor: colors.surface }} contentContainerStyle={{ padding: spacing.md - 2, paddingTop: spacing.md, gap: spacing.md, paddingBottom: spacing.xl }}>
        {shown?.length ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xs }}>
            <Text style={{ color: colors.textMuted, fontSize: rf(13) }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                {shown.length} ride{shown.length === 1 ? "" : "s"}
              </Text>{" "}
              {side === "to" ? "to" : "from"} {OFFICES[office].tag.toLowerCase()}
            </Text>
            <Pressable onPress={() => setFiltering(true)} accessibilityRole="button" accessibilityLabel={active ? `Sort and filter, ${active} on` : "Sort and filter"} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: rs(4) }}>
              <Text style={{ color: colors.textMuted, fontSize: rf(13) }}>{SORTS.find(([k]) => k === filters.sort)[1]}</Text>
              {active ? (
                <View style={{ minWidth: rs(18), height: rs(18), borderRadius: rs(9), paddingHorizontal: rs(5), backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: colors.onPrimary, fontSize: rf(11), fontWeight: "800" }}>{active}</Text>
                </View>
              ) : null}
              <Ionicons name="options-outline" size={rs(16)} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : null}

        {hosts === null ? <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.text} /> : shown.map((h) => <HostCard key={h.id} host={h} pending={pending === h.id} onRequest={() => request(h.id)} onMap={() => openMap(h.id)} />)}

        {hosts && !hosts.length ? (
          <View style={{ alignItems: "center", gap: spacing.md, marginTop: spacing.xl * 2, paddingHorizontal: spacing.md }}>
            <View style={{ width: rs(96), height: rs(96), borderRadius: rs(48), backgroundColor: colors.primarySurface, alignItems: "center", justifyContent: "center" }}>
              <MaterialCommunityIcons name="map-marker-path" size={rs(44)} color={colors.primary} />
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
                  style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.background }}
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
            <Text style={{ color: colors.text, fontWeight: "700" }}>{carOnly && active === 1 ? "No cars at this time" : "No rides match your filters"}</Text>
            <Pressable onPress={() => setFilters(DEFAULT_FILTERS)} accessibilityRole="button">
              <Text style={{ color: colors.primary, fontWeight: "700" }}>{carOnly && active === 1 ? "Show bikes too" : "Clear filters"}</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {picking === "office" ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPicking(null)}>
          <Pressable style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: "flex-start", paddingTop: rs(110), paddingHorizontal: spacing.lg }} onPress={() => setPicking(null)} accessibilityLabel="Close">
            <View style={{ backgroundColor: colors.background, borderRadius: radius.lg, padding: spacing.xs + 2, gap: rs(2) }}>
              <Text style={{ color: colors.textMuted, fontSize: rf(11), fontWeight: "800", letterSpacing: 1, padding: spacing.sm }}>{side === "to" ? "GOING TO" : "LEAVING FROM"}</Text>
              {OFFICES.map((o, i) => (
                <Pressable
                  key={o.id}
                  onPress={() => {
                    setOffice(i);
                    setNotify(false);
                    setPicking(null);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: office === i }}
                  style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", padding: spacing.sm + 4, borderRadius: radius.md, backgroundColor: pressed ? colors.surface : "transparent" })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: office === i ? colors.primary : colors.text, fontWeight: office === i ? "700" : "500", fontSize: fontSize.md }}>{o.name}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{o.tag}</Text>
                  </View>
                  {office === i ? <Ionicons name="checkmark" size={rs(20)} color={colors.primary} /> : null}
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>
      ) : null}
      {picking === "time" ? (
        <WhenSheet
          visible
          title="When do you need a ride?"
          value={defaultWhen()}
          onClose={() => setPicking(null)}
          onDone={(t) => {
            setPicking(null);
            setNotify(false);
            router.setParams({ when: whenLabel(t) });
          }}
        />
      ) : null}
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
