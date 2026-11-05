import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fonts, useTheme } from "../constants/theme";
import { goBack } from "../lib/nav";
import { newSearchSession, retrievePlace, searchPlaces } from "../lib/api";
import { OFFICES } from "../lib/mock";
import { isOffice, placeName, setPlace, useTrips } from "../lib/trips";
import { useArea } from "../lib/useArea";

// pick = which place this screen sets ("pickup", "from", "to", "home"): one search field.
// Without pick it's the guest's ride search: From (your pickup) and To; choosing To opens the ride results.
// field = which of the two starts active ("from" when opened from Home's location pill); when = forwarded to results.
const TITLES = { pickup: "Set pickup", from: "Leaving from", to: "Going to", home: "Set home address" };

// Bold the part of the name that matches what was typed.
function Highlight({ text, query }) {
  const { colors } = useTheme();
  const i = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  const base = { color: colors.text, fontFamily: fonts.bold };
  if (i < 0) return <Text style={base}>{text}</Text>;
  return (
    <Text style={base}>
      {text.slice(0, i)}
      <Text style={{ color: colors.primary, fontFamily: fonts.extrabold }}>{text.slice(i, i + query.length)}</Text>
      {text.slice(i + query.length)}
    </Text>
  );
}

function Row({ icon, iconColor, iconBg, title, subtitle, right, onPress }) {
  const { colors, rs, rf } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: rs(12), paddingVertical: rs(11), borderBottomWidth: 1, borderBottomColor: colors.line, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ width: rs(40), height: rs(40), borderRadius: rs(12), backgroundColor: iconBg ?? colors.surface, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={rs(19)} color={iconColor ?? colors.text} />
      </View>
      <View style={{ flex: 1 }}>
        {typeof title === "string" ? <Text style={{ color: colors.text, fontFamily: fonts.bold, fontSize: rf(15) }}>{title}</Text> : <Text style={{ fontSize: rf(15) }}>{title}</Text>}
        <Text style={{ color: colors.textMuted, fontFamily: fonts.regular, fontSize: rf(12.5) }}>{subtitle}</Text>
      </View>
      {right ? <Text style={{ color: colors.textMuted, fontFamily: fonts.regular, fontSize: rf(12) }}>{right}</Text> : null}
    </Pressable>
  );
}

export default function Places() {
  const { colors, rs, rf } = useTheme();
  const area = useArea();
  const { pick, field: startField, when } = useLocalSearchParams();
  const { places, saved } = useTrips();
  const twoFields = !pick;
  const [field, setField] = useState(startField === "from" ? "from" : "to"); // the guest search's active field
  const [queries, setQueries] = useState({ from: "", to: "" });
  const query = twoFields ? queries[field] : queries.to;
  const [results, setResults] = useState([]);
  const [searchError, setSearchError] = useState(false);
  const [session] = useState(newSearchSession);
  const near = area.coords;
  const toInput = useRef(null);

  // Search as you type (short pause so we don't call the API on every key). Late answers for old text are ignored.
  useEffect(() => {
    let alive = true;
    const id = setTimeout(
      () =>
        searchPlaces(query, { session, near })
          .then((list) => alive && (setResults(list), setSearchError(false)))
          .catch(() => alive && (setResults([]), setSearchError(query.trim().length >= 2))),
      300,
    );
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [query, session, near]);

  const here = { name: area.label, area: "Current location", coords: area.coords, here: true };
  const goResults = (place) => router.push({ pathname: "/results", params: when ? { to: placeName(place), when } : { to: placeName(place) } });

  async function choose(chosen) {
    let place = chosen;
    if (!chosen.here) {
      try {
        place = await retrievePlace(chosen, session);
      } catch {
        return Alert.alert("Couldn’t open that place", "Check your internet connection and try again.");
      }
    }
    if (pick) {
      setPlace(pick, place);
      return router.back();
    }
    if (field === "from") {
      // Your pickup; "current location" is stored as no pickup. Then on to choosing where you're going.
      setPlace("pickup", place.here ? null : place);
      setQueries((q) => ({ ...q, from: "" }));
      setField("to");
      return toInput.current?.focus();
    }
    goResults(place);
  }
  // From a chosen place to current location: going there instead of leaving from there.
  function swap() {
    const old = places.pickup;
    setPlace("pickup", null);
    goResults(old);
  }

  // The other end of the trip; when it isn't an office, this end has to be one.
  const other = twoFields ? (field === "to" ? (places.pickup ?? here) : null) : ({ to: places.from, from: places.to, pickup: null, home: null }[pick] ?? null);
  const officesOnly = !!other && !isOffice(other);
  const q = query.trim().toLowerCase();
  // Never offer the office the trip already starts or ends at (no Old office → Old office).
  const offices = OFFICES.filter((o) => !(isOffice(other) && (o.id === other.id || o.name === other.name))).filter((o) => !officesOnly || !q || `${o.tag} ${o.name}`.toLowerCase().includes(q));
  const label = (text) => <Text style={{ color: colors.textMuted, fontFamily: fonts.bold, fontSize: rf(13), marginTop: rs(16) }}>{text}</Text>;

  const input = (key, dot, placeholder, ref) => {
    const on = !twoFields || field === key;
    return (
      <Pressable
        onPress={() => (key === "to" ? toInput.current?.focus() : setField(key))}
        style={{ flexDirection: "row", alignItems: "center", gap: rs(12), height: rs(52), borderRadius: rs(16), paddingLeft: rs(16), paddingRight: twoFields ? rs(46) : rs(12), backgroundColor: on ? colors.background : colors.surface, borderWidth: 2, borderColor: on ? colors.ink : "transparent" }}
      >
        {dot}
        <TextInput
          ref={ref}
          value={queries[key]}
          onChangeText={(t) => setQueries((qs) => ({ ...qs, [key]: t }))}
          onFocus={() => setField(key)}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          autoFocus={twoFields ? key === field : true}
          accessibilityLabel={key === "from" ? "From" : pick ? "Search a place" : "Where to?"}
          style={{ flex: 1, color: colors.text, fontFamily: fonts.bold, fontSize: rf(15.5), paddingVertical: 0 }}
        />
        {queries[key] ? (
          <Pressable onPress={() => setQueries((qs) => ({ ...qs, [key]: "" }))} accessibilityRole="button" accessibilityLabel="Clear" hitSlop={8}>
            <Ionicons name="close-circle" size={rs(18)} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </Pressable>
    );
  };
  const circle = <View style={{ width: rs(12), height: rs(12), borderRadius: rs(6), borderWidth: rs(3), borderColor: colors.text }} />;
  const square = <View style={{ width: rs(12), height: rs(12), borderRadius: rs(3), backgroundColor: colors.primary }} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: "row", alignItems: twoFields ? "flex-start" : "center", gap: rs(10), paddingHorizontal: rs(16), paddingTop: rs(8), paddingBottom: rs(4) }}>
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={6} style={{ width: rs(42), height: rs(42), borderRadius: rs(21), backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginTop: twoFields ? rs(26) : 0 }}>
          <Ionicons name="chevron-back" size={rs(22)} color={colors.text} />
        </Pressable>
        {twoFields ? (
          <View style={{ flex: 1, gap: rs(8) }}>
            {input("from", circle, places.pickup?.name ?? `Current location · ${area.label}`)}
            {input("to", square, "Where to?", toInput)}
            {places.pickup ? (
              <Pressable onPress={swap} accessibilityRole="button" accessibilityLabel={`Swap: go to ${places.pickup.name} instead`} hitSlop={6} style={{ position: "absolute", right: -rs(6), top: rs(39), width: rs(36), height: rs(36), borderRadius: rs(18), backgroundColor: colors.background, alignItems: "center", justifyContent: "center", elevation: 3, shadowColor: "#0F141E", shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}>
                <Ionicons name="swap-vertical" size={rs(17)} color={colors.text} />
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={{ flex: 1, gap: rs(10) }}>
            <Text style={{ color: colors.text, fontFamily: fonts.extrabold, fontSize: rf(20) }}>{TITLES[pick] ?? "Plan your ride"}</Text>
          </View>
        )}
      </View>
      {twoFields ? null : <View style={{ paddingHorizontal: rs(16), paddingTop: rs(8) }}>{input("to", square, "Search a place", toInput)}</View>}

      <ScrollView contentContainerStyle={{ paddingHorizontal: rs(16), paddingBottom: rs(24) }} keyboardShouldPersistTaps="handled">
        {/* When the other end isn't an office, only the offices can be chosen here. */}
        {officesOnly ? null : (
          <>
            <Row icon="locate" iconColor={colors.primary} iconBg={colors.primarySurface} title="Use current location" subtitle={area.label} onPress={() => choose(here)} />
            <Row icon="map-outline" title="Choose on map" subtitle="Drop a pin anywhere" onPress={() => router.push({ pathname: "/pin", params: pick ? { pick } : field === "from" ? { pick: "pickup" } : {} })} />

            {results.length ? (
              <>
                {label("Results")}
                {results.map((p) => (
                  <Row key={p.mapboxId ?? p.name} icon="location" title={<Highlight text={p.name} query={query.trim()} />} subtitle={p.area} right={p.km != null ? `${p.km} km` : undefined} onPress={() => choose(p)} />
                ))}
              </>
            ) : query.trim().length >= 2 ? (
              <Text style={{ color: colors.textMuted, fontFamily: fonts.regular, marginTop: rs(16) }}>{searchError ? "Search isn’t working right now. Check your internet and try again." : `No places found for “${query}”.`}</Text>
            ) : null}
          </>
        )}

        {label(officesOnly ? "Offices · every ride starts or ends at one" : "Saved")}
        {offices.map((o) => (
          <Row key={o.id} icon="business-outline" title={officesOnly ? <Highlight text={o.tag} query={query.trim()} /> : o.tag} subtitle={o.name} onPress={() => choose(o)} />
        ))}
        {officesOnly ? null : <Row icon="home-outline" title={saved.home.name} subtitle={saved.home.area} onPress={() => choose(saved.home)} />}
        {officesOnly && !offices.length ? <Text style={{ color: colors.textMuted, fontFamily: fonts.regular, marginTop: rs(8) }}>No office matches “{query}”.</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
