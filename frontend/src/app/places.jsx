import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../constants/theme";
import { goBack } from "../lib/nav";
import { newSearchSession, retrievePlace, searchPlaces } from "../lib/api";
import { OFFICES } from "../lib/mock";
import { isOffice, placeName, setPlace, useTrips } from "../lib/trips";
import { useArea } from "../lib/useArea";

// pick = which place this screen sets ("pickup", "from", "to"); without it, choosing a place searches rides.
const TITLES = { pickup: "Set pickup", from: "Leaving from", to: "Going to", home: "Set home address" };

// Bold the part of the name that matches what was typed.
function Highlight({ text, query }) {
  const { colors } = useTheme();
  const i = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (i < 0) return <Text style={{ color: colors.text, fontWeight: "700" }}>{text}</Text>;
  return (
    <Text style={{ color: colors.text, fontWeight: "700" }}>
      {text.slice(0, i)}
      <Text style={{ color: colors.primary, fontWeight: "800" }}>{text.slice(i, i + query.length)}</Text>
      {text.slice(i + query.length)}
    </Text>
  );
}

function Row({ icon, iconColor, iconBg, title, subtitle, right, onPress }) {
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm + 4, borderBottomWidth: 1, borderBottomColor: colors.line, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ width: rs(38), height: rs(38), borderRadius: radius.pill, backgroundColor: iconBg ?? colors.surface, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={rs(18)} color={iconColor ?? colors.text} />
      </View>
      <View style={{ flex: 1 }}>
        {typeof title === "string" ? <Text style={{ color: colors.text, fontWeight: "700", fontSize: fontSize.md }}>{title}</Text> : title}
        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{subtitle}</Text>
      </View>
      {right ? <Text style={{ color: colors.textMuted, fontSize: rf(12) }}>{right}</Text> : null}
    </Pressable>
  );
}

export default function Places() {
  const { colors, spacing, fontSize, radius, rs, rf } = useTheme();
  const area = useArea();
  const { pick } = useLocalSearchParams();
  const { places, saved } = useTrips();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searchError, setSearchError] = useState(false);
  const [session] = useState(newSearchSession);
  const near = area.coords;

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

  async function choose(chosen) {
    let place = chosen;
    try {
      place = await retrievePlace(chosen, session);
    } catch {
      return Alert.alert("Couldn’t open that place", "Check your internet connection and try again.");
    }
    if (!pick) return router.push({ pathname: "/results", params: { to: placeName(place) } });
    setPlace(pick, place);
    router.back();
  }
  const here = { name: area.label, area: "Current location", coords: area.coords };
  // The other end of the trip; when it isn't an office, this end has to be one.
  const other = { to: places.from, from: places.to, pickup: null, home: null }[pick] ?? (pick ? null : (places.pickup ?? here));
  const officesOnly = !!other && !isOffice(other);
  const q = query.trim().toLowerCase();
  // Never offer the office the trip already starts or ends at (no Old office → Old office).
  const offices = OFFICES.filter((o) => !(isOffice(other) && (o.id === other.id || o.name === other.name))).filter((o) => !officesOnly || !q || `${o.tag} ${o.name}`.toLowerCase().includes(q));
  const label = (text) => <Text style={{ color: colors.textMuted, fontSize: rf(11), fontWeight: "800", letterSpacing: 1, marginTop: spacing.md }}>{text}</Text>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm }}>
          <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={10}>
            <Ionicons name="chevron-back" size={rs(24)} color={colors.text} />
          </Pressable>
          <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: "800" }}>{TITLES[pick] ?? "Plan your ride"}</Text>
        </View>

        {pick ? null : (
          <Pressable
            onPress={() => router.push({ pathname: "/places", params: { pick: "pickup" } })}
            accessibilityRole="button"
            accessibilityLabel="Change pickup"
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md + 2, padding: spacing.md }}
          >
            <View style={{ width: rs(12), height: rs(12), borderRadius: rs(6), borderWidth: 2.5, borderColor: colors.text }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textMuted, fontSize: rf(10), fontWeight: "700" }}>PICKUP</Text>
              <Text style={{ color: colors.text, fontSize: fontSize.md }} numberOfLines={1}>
                {places.pickup?.name ?? `Current location · ${area.label}`}
              </Text>
            </View>
            <Text style={{ color: colors.textMuted, fontWeight: "700", fontSize: rf(12) }}>Change</Text>
          </Pressable>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 2, borderColor: colors.ink, borderRadius: radius.md + 2, paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}>
          <View style={{ width: rs(12), height: rs(12), borderRadius: rs(3), backgroundColor: colors.text }} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={pick ? "Search a place" : "Where to?"}
            placeholderTextColor={colors.textMuted}
            autoFocus
            accessibilityLabel={pick ? "Search a place" : "Where to?"}
            style={{ flex: 1, color: colors.text, fontSize: fontSize.md, paddingVertical: spacing.sm + 2 }}
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} accessibilityRole="button" accessibilityLabel="Clear" hitSlop={8}>
              <Ionicons name="close-circle" size={rs(18)} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {/* When the other end isn't an office, only the offices can be chosen here. */}
        {officesOnly ? null : (
          <>
            <Row icon="locate" iconColor={colors.primary} iconBg={colors.primarySurface} title="Use current location" subtitle={area.label} onPress={() => choose(here)} />
            <Row icon="map-outline" title="Choose on map" subtitle="Drop a pin anywhere" onPress={() => router.push({ pathname: "/pin", params: pick ? { pick } : {} })} />

            {results.length ? (
              <>
                {label("RESULTS")}
                {results.map((p) => (
                  <Row key={p.mapboxId ?? p.name} icon="location" title={<Highlight text={p.name} query={query.trim()} />} subtitle={p.area} right={p.km != null ? `${p.km} km` : undefined} onPress={() => choose(p)} />
                ))}
              </>
            ) : query.trim().length >= 2 ? (
              <Text style={{ color: colors.textMuted, marginTop: spacing.md }}>{searchError ? "Search isn’t working right now. Check your internet and try again." : `No places found for “${query}”.`}</Text>
            ) : null}
          </>
        )}

        {label("SAVED")}
        {offices.map((o) => (
          <Row key={o.id} icon="business-outline" title={officesOnly ? <Highlight text={o.tag} query={query.trim()} /> : o.tag} subtitle={o.name} onPress={() => choose(o)} />
        ))}
        {officesOnly ? null : <Row icon="home-outline" title={saved.home.name} subtitle={saved.home.area} onPress={() => choose(saved.home)} />}
        {officesOnly && !offices.length ? <Text style={{ color: colors.textMuted, marginTop: spacing.sm }}>No office matches “{query}”.</Text> : null}
        {officesOnly ? null : <Text style={{ color: colors.textMuted, fontSize: rf(11), textAlign: "center", marginTop: spacing.md }}></Text>}
      </ScrollView>
    </SafeAreaView>
  );
}
