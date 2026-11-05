import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DrivingCar from "../../components/DrivingCar";
import HomeMap from "../../components/HomeMap";
import RideCard from "../../components/RideCard";
import { Avatar, PersonAvatar, Plate } from "../../components/RideUI";
import WhenSheet from "../../components/WhenSheet";
import { fonts, useTheme } from "../../constants/theme";
import { searchRides, setRole } from "../../lib/api";
import { useRoute } from "../../lib/directions";
import { startRide, vehicleColour } from "../../lib/live";
import { maybeAskForNotifications } from "../../lib/notify";
import { resetDraft } from "../../lib/onboarding";
import { ampm } from "../../lib/requestSeat";
import { getSession, updateSession } from "../../lib/session";
import { cancelPublished, confirmWithdraw, isOffice, placeName, publishRide, receiveRequests, swapRoute, useTrips } from "../../lib/trips";
import { confirmSheet } from "../../lib/confirm";
import { useArea } from "../../lib/useArea";
import { dayLabel, defaultWhen, timeLabel, whenLabel } from "../../lib/when";

const first = (name) => name.split(" ")[0];
const HOST_REASONS = ["My plans changed", "My car isn’t available", "I’m not going to the office", "Something else"];
const shadow = { elevation: 5, shadowColor: "#0F141E", shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } };
const pinLabel = (p) => (isOffice(p) ? "Office" : p.id === "home" ? "Home" : p.name);

// ---------- top bar: Account (your picture), where you are, Alerts ----------
function TopBar({ place, unread, gender, photo }) {
  const { colors, rs, rf } = useTheme();
  const insets = useSafeAreaInsets();
  const round = { width: rs(50), height: rs(50), borderRadius: rs(25), backgroundColor: colors.background, alignItems: "center", justifyContent: "center", ...shadow };
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + rs(8), left: rs(14), right: rs(14), flexDirection: "row", alignItems: "center", gap: rs(10) }}>
      <Pressable onPress={() => router.push("/account")} accessibilityRole="button" accessibilityLabel="Account" style={[round, { overflow: "hidden" }]}>
        {photo ? <Image source={{ uri: photo }} style={{ width: rs(50), height: rs(50) }} accessibilityIgnoresInvertColors /> : <PersonAvatar gender={gender} size={rs(50)} />}
      </Pressable>
      <View pointerEvents="box-none" style={{ flex: 1, alignItems: "center" }}>
        <Pressable
          onPress={() => router.push({ pathname: "/places", params: { field: "from" } })}
          accessibilityRole="button"
          accessibilityLabel={`Pickup: ${place}. Change`}
          style={{ maxWidth: "100%", height: rs(50), borderRadius: rs(25), backgroundColor: colors.background, paddingLeft: rs(14), paddingRight: rs(16), flexDirection: "row", alignItems: "center", gap: rs(7), ...shadow }}
        >
          <Ionicons name="location-outline" size={rs(19)} color={colors.primary} />
          <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.bold, fontSize: rf(15.5), color: colors.text }}>
            {place}
          </Text>
          <Ionicons name="chevron-down" size={rs(17)} color={colors.text} />
        </Pressable>
      </View>
      <Pressable onPress={() => router.push("/alerts")} accessibilityRole="button" accessibilityLabel={unread ? `Alerts, ${unread} new` : "Alerts"} style={round}>
        <Ionicons name="notifications-outline" size={rs(23)} color={colors.text} />
        {unread ? <View style={{ position: "absolute", top: rs(12), right: rs(13), width: rs(11), height: rs(11), borderRadius: rs(6), backgroundColor: colors.danger, borderWidth: 2, borderColor: colors.background }} /> : null}
      </Pressable>
    </View>
  );
}

function Segment({ mode, onChange }) {
  const { colors, rs, rf } = useTheme();
  return (
    <View style={{ flexDirection: "row", backgroundColor: colors.surface, borderRadius: rs(14), padding: rs(3) }} accessibilityRole="tablist">
      {[
        ["guest", "Guest"],
        ["host", "Host"],
      ].map(([key, label]) => {
        const on = mode === key;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            hitSlop={{ top: 6, bottom: 6 }}
            style={{ height: rs(36), paddingHorizontal: rs(18), borderRadius: rs(11), justifyContent: "center", backgroundColor: on ? colors.background : "transparent", ...(on ? { elevation: 2, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } } : null) }}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: rf(14.5), color: on ? colors.text : colors.textMuted }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// A ride on the map: its departure time on a dark tag, the vehicle in its own colour.
function RideTag({ host, onPress }) {
  const { colors, rs, rf } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${host.name}, leaves ${host.time} ${ampm(host.time)}`} hitSlop={6} style={{ alignItems: "center", paddingBottom: rs(40) }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: rs(6), backgroundColor: colors.ink, borderRadius: rs(12), paddingVertical: rs(5), paddingLeft: rs(5), paddingRight: rs(10), elevation: 4 }}>
        <View style={{ width: rs(24), height: rs(24), borderRadius: rs(7), backgroundColor: colors.onInk, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name={host.type === "bike" ? "motorbike" : "car"} size={rs(16)} color={vehicleColour(host.vehicle)} />
        </View>
        <Text style={{ fontFamily: fonts.extrabold, fontSize: rf(13.5), color: colors.onInk }}>{host.time}</Text>
      </View>
      <View style={{ width: 0, height: 0, borderLeftWidth: rs(6), borderRightWidth: rs(6), borderTopWidth: rs(7), borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: colors.ink }} />
    </Pressable>
  );
}

function Btn({ title, onPress, kind = "ink", style }) {
  const { colors, rs, rf } = useTheme();
  const bg = { ink: colors.ink, soft: colors.surface, green: colors.green }[kind];
  const fg = { ink: colors.onInk, soft: colors.text, green: colors.onGreen }[kind];
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [{ height: rs(48), borderRadius: rs(24), backgroundColor: bg, alignItems: "center", justifyContent: "center", paddingHorizontal: rs(18), opacity: pressed ? 0.85 : 1 }, style]}>
      <Text style={{ fontFamily: fonts.bold, fontSize: rf(15), color: fg }}>{title}</Text>
    </Pressable>
  );
}

// A card for "you can't do this right now" (one trip at a time) or your booked ride.
function InfoCard({ icon, chip, chipTone, title, text, right, children }) {
  const { colors, rs, rf } = useTheme();
  return (
    <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: rs(18), padding: rs(14), gap: rs(12) }} accessibilityLiveRegion="polite">
      {chip ? (
        <View style={{ alignSelf: "flex-start", backgroundColor: chipTone === "green" ? colors.greenSurface : colors.warningSurface, borderRadius: rs(8), paddingHorizontal: rs(9), paddingVertical: rs(4) }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: rf(12), color: chipTone === "green" ? colors.green : colors.warning }}>{chip}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: rs(12) }}>
        {icon}
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: rf(15.5), color: colors.text }}>{title}</Text>
          {text ? <Text style={{ fontFamily: fonts.regular, fontSize: rf(13), color: colors.textMuted, marginTop: rs(2), lineHeight: rf(18) }}>{text}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

// ---------- Guest ----------
function GuestSheet({ hosts, when, onRide, onHost }) {
  const { colors, rs, rf } = useTheme();
  const { booking, published, saved } = useTrips();
  const waiting = booking?.status === "requested" ? booking : null;
  const accepted = booking?.status === "accepted" ? booking : null;
  const ride = waiting ?? accepted;
  return (
    <>
      <Pressable
        onPress={() => router.push({ pathname: "/places", params: { when: whenLabel(when) } })}
        accessibilityRole="button"
        accessibilityLabel="Where to?"
        style={{ height: rs(58), borderRadius: rs(16), backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: rs(12), paddingHorizontal: rs(16) }}
      >
        <Ionicons name="search" size={rs(22)} color={colors.text} />
        <Text style={{ fontFamily: fonts.extrabold, fontSize: rf(19), color: colors.text }}>Where to?</Text>
      </Pressable>

      {published ? (
        <InfoCard icon={<MaterialCommunityIcons name="steering" size={rs(26)} color={colors.text} />} title={`You’re hosting · ${published.when}`} text="You can’t book a seat while you’re offering a ride. Finish or cancel your ride first.">
          <Btn title="Open my ride" onPress={onHost} />
        </InfoCard>
      ) : ride ? (
        <InfoCard
          chip={waiting ? `Request sent · waiting for ${first(ride.host.name)}` : `Accepted · pickup ${ride.host.time} ${ampm(ride.host.time)}`}
          chipTone={waiting ? "amber" : "green"}
          icon={<Avatar initials={ride.host.initials} gender={ride.host.gender} color={ride.host.color} size={rs(44)} />}
          title={ride.host.name}
          text={ride.host.vehicle}
          right={<Plate text={waiting ? `•• ${ride.host.plate.slice(-4)}` : ride.host.plate} />}
        >
          <View style={{ flexDirection: "row", gap: rs(10) }}>
            {waiting ? (
              <>
                <Btn title="View request" style={{ flex: 1 }} onPress={() => router.push({ pathname: "/results", params: { to: ride.drop.name } })} />
                <Btn title="Withdraw" kind="soft" style={{ flex: 1 }} onPress={() => confirmWithdraw()} />
              </>
            ) : (
              <>
                <Btn title="Details" kind="soft" style={{ flex: 1 }} onPress={() => router.push("/accepted")} />
                <Btn title="Track ride" style={{ flex: 1 }} onPress={() => router.push("/coming")} />
              </>
            )}
          </View>
        </InfoCard>
      ) : (
        <View style={{ gap: rs(8) }}>
          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            {hosts?.length ? (
              <Pressable onPress={() => router.push({ pathname: "/results", params: { to: saved.office.name, when: whenLabel(when) } })} accessibilityRole="button" hitSlop={10}>
                <Text style={{ fontFamily: fonts.bold, fontSize: rf(13.5), color: colors.primary }}>See all {hosts.length} rides</Text>
              </Pressable>
            ) : null}
          </View>
          {hosts === null ? (
            <ActivityIndicator color={colors.text} style={{ marginVertical: rs(30) }} />
          ) : hosts.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -rs(16) }} contentContainerStyle={{ paddingHorizontal: rs(16), gap: rs(10) }}>
              {hosts.map((h) => (
                <RideCard key={h.id} host={h} onPress={() => onRide(h)} />
              ))}
            </ScrollView>
          ) : (
            <InfoCard icon={<Ionicons name="car-outline" size={rs(24)} color={colors.text} />} title="No rides yet" text={`Nobody is driving to ${saved.office.name} ${dayLabel(when).toLowerCase()} yet. Try another time.`} />
          )}
        </View>
      )}
    </>
  );
}

// ---------- Host ----------
function HostSheet({ vehicle, when, onPickTime, timerRef }) {
  const { colors, rs, rf } = useTheme();
  const { published, requests, passengers, places, booking } = useTrips();
  const seats = vehicle.type === "bike" ? 1 : Number(vehicle.seats) || 1;
  const rideSeats = published?.seats ?? seats;
  const full = passengers.length >= rideSeats;
  const riding = booking && ["requested", "accepted"].includes(booking.status) ? booking : null;
  const pickPlace = (pick) => router.push({ pathname: "/places", params: { pick } });

  function onPublish() {
    publishRide({ from: places.from, to: places.to, when: whenLabel(when), at: when, seats });
    // shortcut: example requests arrive a few seconds after publishing; real ones come from the backend as push notifications.
    timerRef.current = setTimeout(receiveRequests, 4000);
    maybeAskForNotifications({ title: "Know when colleagues ask for a seat", text: "Accept or decline right from the notification, and get a reminder when it’s time to leave.", preview: ["A colleague asked for a seat", "Accept or decline from here"] });
  }
  function onCancelRide() {
    const names = (list) => list.map((p) => first(p.name)).join(" and ");
    const note = passengers.length
      ? `${names(passengers)} will be told and can find another ride.`
      : requests.length
        ? `${names(requests)}’s request${requests.length > 1 ? "s" : ""} will be declined.`
        : null;
    confirmSheet({
      title: "Cancel this ride?",
      text: "Colleagues won’t be able to request a seat any more.",
      note: note ? { icon: "people-outline", text: note } : null,
      // Accepted guests are told why (the reason shows on their Ride cancelled page); nobody to tell, no reason needed.
      ...(passengers.length ? { reasons: HOST_REASONS, reasonLabel: `Tell ${names(passengers)} why`, other: "Something else" } : null),
      keep: "Keep ride",
      confirm: "Cancel ride",
      onConfirm: (reason) => {
        clearTimeout(timerRef.current);
        cancelPublished(reason);
      },
    });
  }

  if (riding) {
    return (
      <InfoCard
        icon={<MaterialCommunityIcons name="seat-passenger" size={rs(26)} color={colors.text} />}
        title={riding.status === "accepted" ? `You’re riding with ${first(riding.host.name)}` : `Waiting for ${first(riding.host.name)} to accept`}
        text="You can’t offer a ride while you have a seat booked. Cancel your booking first to host."
      >
        <Btn title={riding.status === "accepted" ? "View my ride" : "View request"} onPress={() => router.push(riding.status === "accepted" ? "/accepted" : { pathname: "/results", params: { to: riding.drop.name } })} />
      </InfoCard>
    );
  }

  const label = (text) => <Text style={{ fontFamily: fonts.regular, fontSize: rf(12), color: colors.textMuted }}>{text}</Text>;
  const value = (text) => (
    <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: rf(15), color: colors.text }}>
      {text}
    </Text>
  );
  const divider = <View style={{ height: 1, backgroundColor: colors.line, marginLeft: rs(42) }} />;

  if (!published) {
    return (
      <>
        <Pressable onPress={() => router.push("/account")} accessibilityRole="button" accessibilityLabel={`${vehicle.model}. Change vehicle`} style={{ flexDirection: "row", alignItems: "center", gap: rs(12), borderWidth: 1, borderColor: colors.line, borderRadius: rs(16), padding: rs(12) }}>
          <View style={{ width: rs(42), height: rs(42), borderRadius: rs(12), backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
            <MaterialCommunityIcons name={vehicle.type === "bike" ? "motorbike" : "car"} size={rs(22)} color={colors.text} />
          </View>
          <View style={{ flex: 1 }}>
            {value(vehicle.model)}
            <Text style={{ fontFamily: fonts.regular, fontSize: rf(12.5), color: colors.textMuted }}>
              {vehicle.plate ? `${vehicle.plate} · ` : ""}
              {seats} seat{seats === 1 ? "" : "s"} free
            </Text>
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: rf(13.5), color: colors.primary }}>Change</Text>
        </Pressable>

        <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: rs(16) }}>
          <Pressable onPress={() => pickPlace("from")} accessibilityRole="button" accessibilityLabel={`From ${placeName(places.from)}. Change`} style={{ flexDirection: "row", alignItems: "center", gap: rs(14), paddingVertical: rs(10), paddingLeft: rs(16), paddingRight: rs(8) }}>
            <View style={{ width: rs(13), height: rs(13), borderRadius: rs(7), borderWidth: rs(3.5), borderColor: colors.text }} />
            <View style={{ flex: 1 }}>
              {label("From")}
              {value(placeName(places.from))}
            </View>
            <Pressable onPress={swapRoute} accessibilityRole="button" accessibilityLabel="Swap from and to" hitSlop={8} style={{ width: rs(40), height: rs(40), borderRadius: rs(20), backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="swap-vertical" size={rs(18)} color={colors.text} />
            </Pressable>
          </Pressable>
          {divider}
          <Pressable onPress={() => pickPlace("to")} accessibilityRole="button" accessibilityLabel={`To ${placeName(places.to)}. Change`} style={{ flexDirection: "row", alignItems: "center", gap: rs(14), paddingVertical: rs(10), paddingHorizontal: rs(16) }}>
            <View style={{ width: rs(13), height: rs(13), borderRadius: rs(3), backgroundColor: colors.primary }} />
            <View style={{ flex: 1 }}>
              {label("To")}
              {value(placeName(places.to))}
            </View>
            <Ionicons name="chevron-forward" size={rs(18)} color={colors.textMuted} />
          </Pressable>
          {divider}
          <Pressable onPress={onPickTime} accessibilityRole="button" accessibilityLabel={`Leaving ${whenLabel(when)}. Change`} style={{ flexDirection: "row", alignItems: "center", gap: rs(12), paddingVertical: rs(10), paddingHorizontal: rs(15) }}>
            <Ionicons name="time-outline" size={rs(17)} color={colors.text} />
            <View style={{ flex: 1 }}>
              {label("Leaving")}
              {value(whenLabel(when).replace(" · ", ", "))}
            </View>
            <Ionicons name="chevron-forward" size={rs(18)} color={colors.textMuted} />
          </Pressable>
        </View>
        <Btn title="Publish ride" onPress={onPublish} style={{ height: rs(52), borderRadius: rs(26) }} />
      </>
    );
  }

  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: rs(12) }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.extrabold, fontSize: rf(19), color: colors.text }}>Your ride is live</Text>
          <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: rf(13), color: colors.textMuted }}>
            {published.when} to {placeName(published.to)}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }} accessible accessibilityLabel={`${passengers.length} of ${rideSeats} seats taken`}>
          <View style={{ flexDirection: "row", gap: rs(4) }}>
            {Array.from({ length: rideSeats }, (_, i) => (
              <View key={i} style={{ width: rs(24), height: rs(24), borderRadius: rs(7), backgroundColor: i < passengers.length ? colors.purple : colors.surface, alignItems: "center", justifyContent: "center" }}>
                <MaterialCommunityIcons name="seat-passenger" size={rs(15)} color={i < passengers.length ? colors.onImage : colors.textMuted} />
              </View>
            ))}
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: rf(11.5), color: colors.textMuted, marginTop: rs(3) }}>
            {passengers.length} of {rideSeats} seats taken
          </Text>
        </View>
      </View>

      {passengers.length ? (
        <View style={{ gap: rs(10) }}>
          {passengers.map((p) => (
            <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: rs(12) }}>
              <Avatar initials={p.initials} gender={p.gender} color="#7C3AED" size={rs(40)} />
              <View style={{ flex: 1 }}>
                {value(p.name)}
                <Text style={{ fontFamily: fonts.regular, fontSize: rf(12.5), color: colors.textMuted }}>
                  Pickup {p.pickupTime} · {p.pickup}
                </Text>
              </View>
              <Text style={{ fontFamily: fonts.bold, fontSize: rf(12.5), color: colors.green }}>Riding with you</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={{ fontFamily: fonts.extrabold, fontSize: rf(15.5), color: colors.text, marginTop: rs(2) }}>{requests.length ? `Seat requests · ${requests.length} new` : "Seat requests"}</Text>
      {full && requests.length ? <Text style={{ fontFamily: fonts.bold, fontSize: rf(13), color: colors.warning }}>Your ride is full. You can still open requests to decline them.</Text> : null}
      {requests.length ? (
        requests.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => router.push({ pathname: "/request", params: { id: r.id } })}
            accessibilityRole="button"
            accessibilityLabel={`Seat request from ${r.name}`}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: rs(12), borderWidth: 1, borderColor: colors.line, borderRadius: rs(16), padding: rs(12), backgroundColor: pressed ? colors.surface : colors.background })}
          >
            <Avatar initials={r.initials} gender={r.gender} color="#7C3AED" size={rs(40)} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: rs(6) }}>
                {value(r.name)}
                <View style={{ backgroundColor: colors.warningSurface, borderRadius: rs(6), paddingHorizontal: rs(6), paddingVertical: rs(1) }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: rf(11), color: colors.warning }}>New</Text>
                </View>
              </View>
              <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: rf(12.5), color: colors.textMuted }}>
                {r.pickup} · {r.pickupTime} · {r.detour} for you
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={rs(18)} color={colors.textMuted} />
          </Pressable>
        ))
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: rs(12), borderRadius: rs(16), backgroundColor: colors.surface, padding: rs(14) }}>
          {full ? <MaterialCommunityIcons name="seat-passenger" size={rs(20)} color={colors.text} /> : <ActivityIndicator color={colors.text} />}
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: rf(14), color: colors.text }}>{full ? "Your ride is full" : "Waiting for requests"}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: rf(12.5), color: colors.textMuted }}>{full ? "New requests can’t be accepted." : "Colleagues on your route can see your ride now."}</Text>
          </View>
        </View>
      )}

      {passengers.length ? (
        <Btn
          title="Start ride"
          style={{ height: rs(52), borderRadius: rs(26) }}
          onPress={() => {
            startRide("host");
            router.push("/drive");
          }}
        />
      ) : null}
      <Pressable onPress={onCancelRide} accessibilityRole="button" hitSlop={8} style={{ alignSelf: "center", paddingVertical: rs(4) }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: rf(14), color: colors.danger }}>Cancel ride</Text>
      </Pressable>
    </>
  );
}

// ---------- "Add your vehicle first" sheet ----------
function NoVehicleSheet({ visible, onClose }) {
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.scrim }} onPress={onClose} accessibilityLabel="Close" />
      <View style={{ backgroundColor: colors.background, borderTopLeftRadius: rs(26), borderTopRightRadius: rs(26), padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg, gap: spacing.md }}>
        <View style={{ alignSelf: "center", width: rs(40), height: rs(4), borderRadius: rs(4), backgroundColor: colors.line }} />
        <DrivingCar radius={radius.lg} />
        <Text style={{ color: colors.text, fontSize: fontSize.xl - 6, fontWeight: "800" }}>Add your vehicle to offer rides</Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.md, lineHeight: rf(22) }}>Tell us about your car or bike.</Text>
        <Pressable
          onPress={() => {
            onClose();
            resetDraft();
            router.push("/vehicle-type");
          }}
          accessibilityRole="button"
          style={{ backgroundColor: colors.green, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: "center" }}
        >
          <Text style={{ color: colors.onGreen, fontWeight: "800", fontSize: fontSize.md }}>Add my vehicle</Text>
        </Pressable>
        <Pressable onPress={onClose} accessibilityRole="button" style={{ backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: "center" }}>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md }}>Not now</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// ---------- Home: the map with rides (guest) or your route (host), and one sheet below ----------
export default function Home() {
  const { colors, rs, rf } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const area = useArea();
  const { places, saved, alerts, published, requests, passengers } = useTrips();
  const { added } = useLocalSearchParams();
  const [, refresh] = useState(0);
  const [noVehicle, setNoVehicle] = useState(false);
  const [toast, setToast] = useState(added === "1" ? "Vehicle added. You're ready to host." : "");
  const [when, setWhen] = useState(defaultWhen);
  const [picking, setPicking] = useState(false);
  const [hosts, setHosts] = useState(null);
  const [sheetH, setSheetH] = useState(rs(330));
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);
  useFocusEffect(useCallback(() => refresh((n) => n + 1), []));
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(id);
  }, [toast]);
  // Rides to your office (the same list the results page shows).
  const officeId = saved.office.id;
  useEffect(() => {
    let alive = true;
    searchRides(officeId)
      .then((list) => alive && setHosts(list))
      .catch(() => alive && setHosts([]));
    return () => {
      alive = false;
    };
  }, [officeId]);

  const session = getSession();
  const mode = session?.role === "host" && session?.vehicle ? "host" : "guest";
  const trip = published ?? places;
  const route = useRoute(mode === "host" && trip.from?.coords && trip.to?.coords ? [trip.from.coords, trip.to.coords] : null);
  if (!session) return null;

  function switchMode(next) {
    if (next === mode) return;
    if (next === "host" && !session.vehicle) return setNoVehicle(true);
    updateSession({ role: next });
    setRole(session.email, next).catch(() => {});
    refresh((n) => n + 1);
  }
  const openRide = (h) => router.push({ pathname: "/pickup-map", params: { id: h.id, office: officeId, when: whenLabel(when) } });

  // What the map shows: rides near you (guest), or your route with requests and guests (host).
  const pin = (p, ring) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: rs(6), backgroundColor: colors.background, borderRadius: rs(14), paddingVertical: rs(4), paddingLeft: rs(4), paddingRight: rs(10), borderWidth: 2, borderColor: ring, elevation: 4, marginBottom: rs(38) }}>
      <Avatar initials={p.initials} gender={p.gender} color="#7C3AED" size={rs(24)} />
      <Text style={{ fontFamily: fonts.bold, fontSize: rf(12.5), color: colors.text }}>{first(p.name)}</Text>
    </View>
  );
  const markers =
    mode === "guest"
      ? (hosts ?? []).map((h) => ({ id: h.id, coords: h.start, node: <RideTag host={h} onPress={() => openRide(h)} /> }))
      : [
          { id: "from", coords: trip.from.coords, node: <View style={{ width: rs(16), height: rs(16), borderRadius: rs(8), backgroundColor: colors.background, borderWidth: rs(4), borderColor: colors.text }} /> },
          {
            id: "to",
            coords: trip.to.coords,
            node: (
              <View style={{ flexDirection: "row", alignItems: "center", gap: rs(5), backgroundColor: colors.primary, borderRadius: rs(11), paddingVertical: rs(5), paddingHorizontal: rs(9), elevation: 4, marginBottom: rs(34) }}>
                <Ionicons name="business" size={rs(13)} color={colors.onPrimary} />
                <Text style={{ fontFamily: fonts.bold, fontSize: rf(12.5), color: colors.onPrimary }}>{pinLabel(trip.to)}</Text>
              </View>
            ),
          },
          ...(published ? requests : []).map((r) => ({ id: r.id, coords: r.coords, node: pin(r, "#F5A524") })),
          ...(published ? passengers : []).map((p) => ({ id: `p-${p.id}`, coords: p.coords, node: pin(p, colors.purple) })),
        ];
  const fit = mode === "guest" ? [...(area.coords ? [area.coords] : []), ...(hosts ?? []).map((h) => h.start)] : [trip.from.coords, trip.to.coords, ...(published ? [...requests, ...passengers].map((r) => r.coords) : [])];
  const unread = alerts.filter((a) => !a.read).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <HomeMap
        markers={markers}
        route={mode === "host" ? route?.coords : null}
        fit={fit}
        padding={{ top: insets.top + rs(90), bottom: sheetH + rs(24), left: rs(64), right: rs(64) }}
        locateBottom={sheetH + rs(14)}
      />
      <TopBar place={places.pickup?.name ?? area.label} unread={unread} gender={session.gender} photo={session.photo} />
      {toast ? (
        <View style={{ position: "absolute", top: insets.top + rs(68), alignSelf: "center", flexDirection: "row", alignItems: "center", gap: rs(8), backgroundColor: colors.greenSurface, borderRadius: rs(14), paddingVertical: rs(8), paddingHorizontal: rs(12), ...shadow }} accessibilityLiveRegion="polite">
          <Ionicons name="checkmark-circle" size={rs(18)} color={colors.green} />
          <Text style={{ fontFamily: fonts.bold, fontSize: rf(13), color: colors.green }}>{toast}</Text>
        </View>
      ) : null}

      <View
        onLayout={(e) => setSheetH(e.nativeEvent.layout.height)}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: height * 0.68, backgroundColor: colors.background, borderTopLeftRadius: rs(28), borderTopRightRadius: rs(28), paddingTop: rs(10), paddingHorizontal: rs(16), paddingBottom: insets.bottom + rs(14), elevation: 14, shadowColor: "#0F141E", shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: -6 } }}
      >
        <View style={{ alignSelf: "center", width: rs(38), height: rs(4), borderRadius: rs(2), backgroundColor: colors.line, marginBottom: rs(12) }} />
        <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={{ gap: rs(12) }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: rs(8) }}>
            <Segment mode={mode} onChange={switchMode} />
            {mode === "guest" ? (
              <Pressable onPress={() => setPicking(true)} accessibilityRole="button" accessibilityLabel={`Leaving ${whenLabel(when)}. Change time`} style={{ height: rs(40), borderRadius: rs(20), backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: rs(6), paddingHorizontal: rs(12) }}>
                <Ionicons name="time-outline" size={rs(16)} color={colors.text} />
                <Text style={{ fontFamily: fonts.bold, fontSize: rf(13), color: colors.text }}>
                  {dayLabel(when)} {timeLabel(when)}
                </Text>
              </Pressable>
            ) : route ? (
              <Text style={{ fontFamily: fonts.semibold, fontSize: rf(12.5), color: colors.textMuted }}>
                {route.km.toFixed(1)} km, {Math.round(route.minutes)} min
              </Text>
            ) : null}
          </View>
          {mode === "host" ? (
            <HostSheet vehicle={session.vehicle} when={when} onPickTime={() => setPicking(true)} timerRef={timerRef} />
          ) : (
            <GuestSheet hosts={hosts} when={when} onRide={openRide} onHost={() => switchMode("host")} />
          )}
        </ScrollView>
      </View>

      {picking ? (
        <WhenSheet
          visible
          title={mode === "host" ? "When are you leaving?" : "When do you need a ride?"}
          value={when}
          onClose={() => setPicking(false)}
          onDone={(t) => {
            setWhen(t);
            setPicking(false);
          }}
        />
      ) : null}
      <NoVehicleSheet visible={noVehicle} onClose={() => setNoVehicle(false)} />
    </View>
  );
}
