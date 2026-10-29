import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar, Plate } from "../../components/RideUI";
import WhenSheet from "../../components/WhenSheet";
import { useTheme } from "../../constants/theme";
import { setRole } from "../../lib/api";
import { OFFICES } from "../../lib/mock";
import { resetDraft } from "../../lib/onboarding";
import { getSession, updateSession } from "../../lib/session";
import { cancelPublished, confirmWithdraw, placeName, publishRide, receiveRequests, swapRoute, useTrips } from "../../lib/trips";
import { useArea } from "../../lib/useArea";
import { defaultWhen, whenLabel } from "../../lib/when";

const carPhoto = require("../../../assets/images/onboarding/car.jpg");

// ---------- small pieces ----------
function Section({ title, action, onAction }) {
  const { colors, fontSize } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
      <Text style={{ color: colors.text, fontSize: fontSize.lg - 2, fontWeight: "800" }}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, fontWeight: "600" }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function PlaceRow({ icon, title, subtitle, time, onPress, last }) {
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}, ${time ? `next ride ${time}` : "no rides yet"}`}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm + 4, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.line, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ width: rs(42), height: rs(42), borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={rs(20)} color={colors.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: "700" }}>{title}</Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{subtitle}</Text>
      </View>
      {time ? (
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: "800" }}>{time}</Text>
          <Text style={{ color: colors.textMuted, fontSize: rf(11) }}>next ride</Text>
        </View>
      ) : (
        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, fontWeight: "600" }}>No rides yet</Text>
      )}
    </Pressable>
  );
}

function Tile({ icon, color, label, onPress }) {
  const { colors, spacing, radius, rs, rf } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ flex: 1, alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.lg + 2, backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 })}
    >
      <MaterialCommunityIcons name={icon} size={rs(30)} color={color} />
      <Text style={{ color: colors.text, fontSize: rf(12), fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

// Shown when the other mode already has a trip: you can't ride and host at the same time.
function BusyNotice({ icon, title, text, action, onAction }) {
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  return (
    <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg + 4, padding: spacing.md, gap: spacing.md }} accessibilityLiveRegion="polite">
      <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
        <View style={{ width: rs(42), height: rs(42), borderRadius: rs(21), backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name={icon} size={rs(22)} color={colors.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md }}>{title}</Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, lineHeight: rf(19) }}>{text}</Text>
        </View>
      </View>
      <Pressable onPress={onAction} accessibilityRole="button" style={{ backgroundColor: colors.ink, borderRadius: radius.lg, paddingVertical: spacing.sm + 4, alignItems: "center" }}>
        <Text style={{ color: colors.onInk, fontWeight: "800" }}>{action}</Text>
      </Pressable>
    </View>
  );
}

// ---------- Find a ride ----------
function FindView() {
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  const { booking, saved, published } = useTrips();
  const [scheduling, setScheduling] = useState(false);
  const accepted = booking?.status === "accepted" ? booking : null;
  const waiting = booking?.status === "requested" ? booking : null;
  const goResults = (to, when) => router.push({ pathname: "/results", params: when ? { to, when } : { to } });

  if (published) {
    return (
      <BusyNotice
        icon="steering"
        title={`You’re hosting · ${published.when}`}
        text="You can’t book a seat while you’re offering a ride. Finish or cancel your ride first."
        action="Go to my ride"
        onAction={() => router.push("/rides")}
      />
    );
  }

  return (
    <View style={{ gap: spacing.lg }}>
      <Pressable
        onPress={() => router.push("/places")}
        accessibilityRole="button"
        accessibilityLabel="Where to?"
        style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, backgroundColor: colors.surface, borderRadius: radius.pill, paddingVertical: spacing.sm, paddingLeft: spacing.md + 2, paddingRight: spacing.sm }}
      >
        <Ionicons name="search" size={rs(20)} color={colors.text} />
        <Text style={{ flex: 1, color: colors.text, fontSize: fontSize.lg - 2, fontWeight: "700" }}>Where to?</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: rs(4), backgroundColor: colors.background, borderRadius: radius.pill, paddingHorizontal: spacing.sm + 4, paddingVertical: spacing.sm }}>
          <Ionicons name="time-outline" size={rs(15)} color={colors.text} />
          <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: "700" }}>Now</Text>
          <Ionicons name="chevron-down" size={rs(13)} color={colors.text} />
        </View>
      </Pressable>

      <View>
        {OFFICES.map((o) => (
          <PlaceRow key={o.id} icon="business-outline" title={o.tag} subtitle={o.name} time={o.id === "bellandur" ? "8:35" : null} onPress={() => goResults(o.name)} />
        ))}
        <PlaceRow icon="home-outline" title={saved.home.name} subtitle={saved.home.area} time="6:10" onPress={() => goResults(saved.home.area)} last />
      </View>

      {waiting ? (
        <>
          <Section title="Upcoming" action="All rides" onAction={() => router.push("/rides")} />
          <Pressable onPress={() => router.push("/requested")} accessibilityRole="button" style={{ borderRadius: radius.lg + 4, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: spacing.md, backgroundColor: colors.background }}>
            <View style={{ alignSelf: "flex-start", backgroundColor: colors.warningSurface, borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: rs(4) }}>
              <Text style={{ color: colors.warning, fontSize: rf(12), fontWeight: "800" }}>Request sent · waiting for {waiting.host.name.split(" ")[0]}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Avatar initials={waiting.host.initials} color={waiting.host.color} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: "700" }}>{waiting.host.name}</Text>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }} numberOfLines={1}>Leaves {waiting.host.time} AM · {waiting.pickup?.name ?? "your pickup"}</Text>
              </View>
              <Plate text={waiting.host.plate} />
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable onPress={() => router.push("/requested")} accessibilityRole="button" style={{ flex: 1, backgroundColor: colors.ink, borderRadius: radius.lg, paddingVertical: spacing.sm + 4, alignItems: "center" }}>
                <Text style={{ color: colors.onInk, fontWeight: "800" }}>View request</Text>
              </Pressable>
              <Pressable onPress={() => confirmWithdraw()} accessibilityRole="button" style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: spacing.sm + 4, alignItems: "center" }}>
                <Text style={{ color: colors.danger, fontWeight: "800" }}>Withdraw</Text>
              </Pressable>
            </View>
          </Pressable>
        </>
      ) : accepted ? (
        <>
          <Section title="Upcoming" action="All rides" onAction={() => router.push("/rides")} />
          <Pressable onPress={() => router.push("/accepted")} accessibilityRole="button" style={{ borderRadius: radius.lg + 4, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: spacing.md, backgroundColor: colors.background }}>
            <View style={{ alignSelf: "flex-start", backgroundColor: colors.greenSurface, borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: rs(4) }}>
              <Text style={{ color: colors.green, fontSize: rf(12), fontWeight: "800" }}>Accepted · pickup {accepted.host.time} AM</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Avatar initials={accepted.host.initials} color={accepted.host.color} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: "700" }}>{accepted.host.name}</Text>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{accepted.host.vehicle}</Text>
              </View>
              <Plate text={accepted.host.plate} />
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable onPress={() => router.push("/coming")} accessibilityRole="button" style={{ flex: 1, backgroundColor: colors.ink, borderRadius: radius.lg, paddingVertical: spacing.sm + 4, alignItems: "center" }}>
                <Text style={{ color: colors.onInk, fontWeight: "800" }}>Track ride</Text>
              </Pressable>
              <Pressable onPress={() => router.push("/accepted")} accessibilityRole="button" style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: spacing.sm + 4, alignItems: "center" }}>
                <Text style={{ color: colors.text, fontWeight: "800" }}>Details</Text>
              </Pressable>
            </View>
          </Pressable>
        </>
      ) : (
        <>
          <Section title="Suggestions" />
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Tile icon="office-building" color="#1D4ED8" label="To office" onPress={() => goResults(saved.office.name)} />
            <Tile icon="home-variant" color="#F59E0B" label="To home" onPress={() => goResults(saved.home.area)} />
            <Tile icon="calendar-clock" color={colors.green} label="Schedule" onPress={() => setScheduling(true)} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.greenSurface, borderRadius: radius.lg, padding: spacing.md }}>
            <View style={{ width: rs(42), height: rs(42), borderRadius: radius.md + 2, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="leaf-outline" size={rs(22)} color={colors.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.green, fontSize: fontSize.md, fontWeight: "800" }}>Share rides, cut traffic</Text>
              <Text style={{ color: colors.green, fontSize: fontSize.sm, opacity: 0.85 }}>Every shared ride takes one car off the road.</Text>
            </View>
          </View>
        </>
      )}
      {scheduling ? (
        <WhenSheet
          visible
          title="When do you need a ride?"
          value={defaultWhen()}
          onClose={() => setScheduling(false)}
          onDone={(t) => {
            setScheduling(false);
            goResults(saved.office.name, whenLabel(t));
          }}
        />
      ) : null}
    </View>
  );
}

// ---------- Offer a ride ----------
function OfferView({ vehicle }) {
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  const { published, requests, passengers, places, booking } = useTrips();
  const seats = vehicle.type === "bike" ? 1 : Number(vehicle.seats) || 1;
  const rideSeats = published?.seats ?? seats;
  const full = passengers.length >= rideSeats;
  const riding = booking && ["requested", "accepted"].includes(booking.status) ? booking : null;
  const [when, setWhen] = useState(defaultWhen);
  const [picking, setPicking] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  function onCancelRide() {
    const who = passengers.length ? `${passengers.map((p) => p.name.split(" ")[0]).join(", ")} will be told and can find another ride.` : "Colleagues won’t be able to request a seat any more.";
    Alert.alert("Cancel this ride?", who, [
      { text: "Keep ride", style: "cancel" },
      {
        text: "Cancel ride",
        style: "destructive",
        onPress: () => {
          clearTimeout(timer.current);
          cancelPublished();
        },
      },
    ]);
  }

  function onPublish() {
    publishRide({ from: places.from, to: places.to, when: whenLabel(when), at: when, seats });
    // shortcut: example requests arrive a few seconds after publishing; real ones come from the backend as push notifications.
    timer.current = setTimeout(receiveRequests, 4000);
  }

  const pickPlace = (pick) => router.push({ pathname: "/places", params: { pick } });
  const row = (icon, label, value, right, onPress, last) => (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${label}: ${value}`}
      style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.line }}
    >
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textMuted, fontSize: rf(11), fontWeight: "600" }}>{label}</Text>
        <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: "700" }}>{value}</Text>
      </View>
      {right}
    </Pressable>
  );
  const dot = (square) => <View style={{ width: rs(12), height: rs(12), borderRadius: square ? 3 : 6, borderWidth: 2.5, borderColor: colors.text, backgroundColor: square ? colors.text : "transparent" }} />;

  return (
    <View style={{ gap: spacing.lg }}>
      <Pressable onPress={() => router.push("/account")} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <MaterialCommunityIcons name={vehicle.type === "bike" ? "motorbike" : "car"} size={rs(18)} color={colors.text} />
        <Text style={{ color: colors.text, fontWeight: "700", fontSize: fontSize.sm }}>{vehicle.model}</Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>· {vehicle.type === "bike" ? "1 seat" : `${vehicle.seats} seats`}</Text>
        <Text style={{ marginLeft: "auto", color: colors.text, fontWeight: "700", fontSize: fontSize.sm, textDecorationLine: "underline" }}>Change</Text>
      </Pressable>

      {published ? (
        <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <Ionicons name="checkmark-circle" size={rs(24)} color={colors.green} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: fontSize.md }}>Ride published · {published.when}</Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{placeName(published.from)} → {placeName(published.to)}</Text>
            </View>
          </View>
          <Pressable onPress={onCancelRide} accessibilityRole="button" style={{ borderWidth: 1.5, borderColor: colors.danger, borderRadius: radius.lg, paddingVertical: spacing.sm + 4, alignItems: "center" }}>
            <Text style={{ color: colors.danger, fontWeight: "800" }}>Cancel ride</Text>
          </Pressable>
        </View>
      ) : riding ? (
        <BusyNotice
          icon="seat-passenger"
          title={riding.status === "accepted" ? `You’re riding with ${riding.host.name.split(" ")[0]}` : `Waiting for ${riding.host.name.split(" ")[0]} to accept`}
          text="You can’t offer a ride while you have a seat booked. Cancel your booking first to host."
          action={riding.status === "accepted" ? "View my ride" : "View request"}
          onAction={() => router.push(riding.status === "accepted" ? "/accepted" : "/requested")}
        />
      ) : (
        <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg + 4, overflow: "hidden" }}>
          {row(
            dot(false),
            "Leaving from",
            placeName(places.from),
            <Pressable onPress={swapRoute} accessibilityRole="button" accessibilityLabel="Swap leaving from and going to" hitSlop={10} style={{ width: rs(34), height: rs(34), borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="swap-vertical" size={rs(18)} color={colors.text} />
            </Pressable>,
            () => pickPlace("from"),
          )}
          {row(dot(true), "Going to", placeName(places.to), <Text style={{ color: colors.textMuted, fontWeight: "700", fontSize: rf(12) }}>Change</Text>, () => pickPlace("to"))}
          {row(<Ionicons name="calendar-outline" size={rs(18)} color={colors.text} />, "When", whenLabel(when), <Text style={{ color: colors.textMuted, fontWeight: "700", fontSize: rf(12) }}>Change</Text>, () => setPicking(true), true)}
          <Pressable onPress={onPublish} accessibilityRole="button" style={({ pressed }) => ({ backgroundColor: colors.green, paddingVertical: spacing.md, alignItems: "center", opacity: pressed ? 0.85 : 1 })}>
            <Text style={{ color: colors.onGreen, fontWeight: "800", fontSize: fontSize.md }}>Publish ride</Text>
          </Pressable>
        </View>
      )}

      {picking ? (
        <WhenSheet
          visible
          value={when}
          onClose={() => setPicking(false)}
          onDone={(t) => {
            setWhen(t);
            setPicking(false);
          }}
        />
      ) : null}

      {passengers.length ? (
        <>
          <Section title={`Your guests · ${passengers.length} of ${rideSeats} seats filled`} />
          <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg + 4, padding: spacing.md, gap: spacing.md }}>
            {passengers.map((p) => (
              <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <Avatar initials={p.initials} color="#7C3AED" />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: fontSize.md }}>{p.name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Pickup {p.pickupTime} · {p.pickup}</Text>
                </View>
              </View>
            ))}
            <Pressable onPress={() => router.push("/drive")} accessibilityRole="button" style={{ backgroundColor: colors.green, borderRadius: radius.lg, paddingVertical: spacing.md - 2, alignItems: "center" }}>
              <Text style={{ color: colors.onGreen, fontWeight: "800" }}>Start ride</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      <Section title={requests.length ? `Seat requests · ${requests.length} new` : "Seat requests"} />
      {published && full && requests.length ? (
        <Text style={{ color: colors.warning, fontWeight: "700", fontSize: fontSize.sm }}>Your ride is full. You can still open requests to decline them.</Text>
      ) : null}
      {requests.length ? (
        requests.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => router.push({ pathname: "/request", params: { id: r.id } })}
            accessibilityRole="button"
            accessibilityLabel={`Seat request from ${r.name}`}
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg + 2, padding: spacing.md }}
          >
            <Avatar initials={r.initials} color="#7C3AED" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: fontSize.md }}>{r.name}</Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{r.rides} rides · {r.pickup} · {r.pickupTime}</Text>
            </View>
            <Ionicons name="chevron-forward" size={rs(18)} color={colors.textMuted} />
          </Pressable>
        ))
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md }}>
          <MaterialCommunityIcons name="seat-passenger" size={rs(22)} color={colors.text} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>No requests yet</Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
              {published ? "Waiting for colleagues on your route." : "Publish a ride and colleagues on your route can ask for your seat."}
            </Text>
          </View>
        </View>
      )}
    </View>
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
        <Image source={carPhoto} style={{ width: "100%", height: rs(130), borderRadius: radius.lg }} resizeMode="cover" accessible={false} />
        <Text style={{ color: colors.text, fontSize: fontSize.xl - 6, fontWeight: "800" }}>Add your vehicle to offer rides</Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.md, lineHeight: rf(22) }}>Tell us about your bike or car once. About 2 minutes, and we can read it from your RC.</Text>
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

// ---------- Home ----------
export default function Home() {
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  const area = useArea();
  const { places } = useTrips();
  const pickup = places.pickup?.name ?? area.label;
  const { added } = useLocalSearchParams();
  const [, refresh] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState(added === "1" ? "Vehicle added. You're ready to host." : "");
  useFocusEffect(useCallback(() => refresh((n) => n + 1), []));
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const session = getSession();
  if (!session) return null;
  const mode = session.role === "host" ? "host" : "guest";

  function switchMode(next) {
    if (next === mode) return;
    if (next === "host" && !session.vehicle) return setSheet(true);
    updateSession({ role: next });
    setRole(session.email, next).catch(() => {});
    refresh((n) => n + 1);
  }

  const tab = (key, icon, label) => (
    <Pressable
      key={key}
      onPress={() => switchMode(key)}
      accessibilityRole="tab"
      accessibilityState={{ selected: mode === key }}
      style={{ flex: 1, alignItems: "center", paddingVertical: spacing.sm + 4, borderBottomWidth: 3, borderBottomColor: mode === key ? colors.ink : "transparent", flexDirection: "row", justifyContent: "center", gap: rs(6) }}
    >
      <Ionicons name={icon} size={rs(16)} color={mode === key ? colors.text : colors.textMuted} />
      <Text style={{ color: mode === key ? colors.text : colors.textMuted, fontWeight: "700", fontSize: fontSize.md }}>{label}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.md, gap: spacing.lg }}>
        <Pressable onPress={() => router.push({ pathname: "/places", params: { pick: "pickup" } })} accessibilityRole="button" accessibilityLabel={`Pickup: ${pickup}. Change`} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 }}>
          <View style={{ width: rs(40), height: rs(40), borderRadius: radius.md + 2, backgroundColor: colors.primarySurface, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="location" size={rs(20)} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textMuted, fontSize: rf(11), fontWeight: "600" }}>{places.pickup ? "Pickup" : "Your location"}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: rs(4) }}>
              <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: "800" }} numberOfLines={1}>{pickup}</Text>
              <Ionicons name="chevron-down" size={rs(14)} color={colors.text} />
            </View>
          </View>
        </Pressable>

        <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.line }} accessibilityRole="tablist">
          {tab("guest", "search", "Find a ride")}
          {tab("host", "car-outline", "Offer a ride")}
        </View>

        {toast ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.greenSurface, borderRadius: radius.md + 2, padding: spacing.sm + 4 }} accessibilityLiveRegion="polite">
            <Ionicons name="checkmark-circle" size={rs(18)} color={colors.green} />
            <Text style={{ color: colors.green, fontWeight: "700", fontSize: fontSize.sm }}>{toast}</Text>
          </View>
        ) : null}

        {mode === "host" && session.vehicle ? <OfferView vehicle={session.vehicle} /> : <FindView />}
      </ScrollView>
      <NoVehicleSheet visible={sheet} onClose={() => setSheet(false)} />
    </SafeAreaView>
  );
}
