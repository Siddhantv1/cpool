import { Ionicons } from "@expo/vector-icons";
import { Camera, MapView, UserLocation } from "@rnmapbox/maps";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NoMapToken } from "../components/LiveMap";
import { MapSheet, RoundButton } from "../components/RideUI";
import { useTheme } from "../constants/theme";
import { goBack } from "../lib/nav";
import { hasMapboxToken, MAP_STYLES } from "../lib/mapbox";
import { MEET_POINT } from "../lib/mock";
import { placeName, setPlace } from "../lib/trips";

const FALLBACK = MEET_POINT.coords;
const TITLES = { pickup: "Confirm pickup", from: "Confirm start", to: "Confirm destination" };

// Drop a pin: move the map under the fixed pin, then confirm. Opened from the places screen.
export default function Pin() {
  const { colors, spacing, fontSize, radius } = useTheme();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { pick } = useLocalSearchParams();
  const [start, setStart] = useState(null);
  const [center, setCenter] = useState(null);
  const [label, setLabel] = useState("");
  const lookup = useRef(0);
  const camera = useRef(null);
  const [located, setLocated] = useState(false); // location allowed: show the blue dot

  // Start at the phone's last known position (no permission prompt here; falls back to the example meet point).
  useEffect(() => {
    const begin = (lngLat) => {
      setStart(lngLat);
      onMoved(lngLat);
    };
    Location.getForegroundPermissionsAsync().then((p) => setLocated(p.granted)).catch(() => {});
    Location.getLastKnownPositionAsync()
      .then((p) => begin(p ? [p.coords.longitude, p.coords.latitude] : FALLBACK))
      .catch(() => begin(FALLBACK));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onMoved(lngLat) {
    // The map also goes idle after tiles load; skip when the centre hasn't moved.
    if (center && Math.abs(center[0] - lngLat[0]) < 1e-6 && Math.abs(center[1] - lngLat[1]) < 1e-6) return;
    setCenter(lngLat);
    setLabel("");
    const id = ++lookup.current;
    try {
      const [place] = await Location.reverseGeocodeAsync({ longitude: lngLat[0], latitude: lngLat[1] });
      const name = [place?.name, place?.street, place?.district || place?.city].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).slice(0, 2).join(", ");
      if (id === lookup.current) setLabel(name || "Pinned location");
    } catch {
      if (id === lookup.current) setLabel("Pinned location");
    }
  }

  // "My location" button: centre the pin on where the phone is now.
  async function goToMe() {
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) return Alert.alert("Location is off", "Allow location access in Settings to use your current location.");
      setLocated(true);
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      camera.current?.setCamera({ centerCoordinate: [p.coords.longitude, p.coords.latitude], zoomLevel: 17, animationDuration: 600 });
    } catch {
      Alert.alert("Couldn't find you", "Check that location is turned on, then try again.");
    }
  }

  function confirm() {
    const place = { name: label || "Pinned location", area: "Pinned on map", coords: center };
    if (!pick) return router.replace({ pathname: "/results", params: { to: placeName(place) } });
    setPlace(pick, place);
    router.dismiss(2); // close this screen and the places screen
  }

  if (!start) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1 }}>
        {hasMapboxToken ? (
          <MapView style={{ flex: 1 }} styleURL={scheme === "dark" ? MAP_STYLES.dark : MAP_STYLES.light} scaleBarEnabled={false} compassEnabled={false} onMapIdle={(state) => onMoved(state.properties.center)}>
            <Camera ref={camera} defaultSettings={{ centerCoordinate: start, zoomLevel: 16 }} />
            {located ? <UserLocation visible /> : null}
          </MapView>
        ) : (
          <NoMapToken />
        )}
        {/* The pin's tip sits exactly on the map centre. */}
        <View pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" }}>
          <View style={{ alignItems: "center", marginBottom: 46 }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.onInk }} />
            </View>
            <View style={{ width: 3, height: 12, backgroundColor: colors.ink }} />
          </View>
        </View>
        <View style={{ position: "absolute", top: insets.top + spacing.sm, left: spacing.md }}>
          <RoundButton icon="arrow-back" label="Go back" onPress={goBack} />
        </View>
        <View style={{ position: "absolute", bottom: spacing.md, right: spacing.md }}>
          <RoundButton icon="locate" label="Use my current location" color={colors.primary} onPress={goToMe} />
        </View>
      </View>

      <MapSheet>
        <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>MOVE THE MAP TO PLACE THE PIN</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 44 }}>
          <Ionicons name="location" size={22} color={colors.text} />
          {center && !label ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={{ flex: 1, color: colors.text, fontSize: fontSize.md, fontWeight: "700" }} numberOfLines={2} accessibilityLiveRegion="polite">
              {label || "Drag the map to choose a spot"}
            </Text>
          )}
        </View>
        <Pressable
          onPress={confirm}
          disabled={!center}
          accessibilityRole="button"
          accessibilityState={{ disabled: !center }}
          style={({ pressed }) => ({ backgroundColor: center ? colors.ink : colors.disabled, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: "center", opacity: pressed ? 0.85 : 1 })}
        >
          <Text style={{ color: colors.onInk, fontWeight: "800", fontSize: fontSize.md }}>{TITLES[pick] ?? "Find rides to here"}</Text>
        </Pressable>
      </MapSheet>
    </View>
  );
}
