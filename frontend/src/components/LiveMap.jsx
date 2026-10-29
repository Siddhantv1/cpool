import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Camera, LineLayer, MapView, MarkerView, ShapeSource, UserLocation } from "@rnmapbox/maps";
import * as Location from "expo-location";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, useColorScheme, View } from "react-native";
import { useTheme } from "../constants/theme";
import { registerMap } from "../lib/mapControl";
import { hasMapboxToken, MAP_STYLES, toBounds } from "../lib/mapbox";
import { boundsOf, lineFeature } from "../lib/route";

// A pin on the map. kind: "start" | "pickup" | "office" | "guest" (a colleague walking to the pickup)
// | "person" (a colleague's profile badge; focused = the one you're looking at: bigger, ringed, with a pointer)
function Pin({ kind, label, focused }) {
  const { colors, radius, rs, rf } = useTheme();
  if (kind === "person") {
    const d = focused ? rs(46) : rs(30);
    return (
      <View style={{ alignItems: "center", opacity: focused ? 1 : 0.7 }}>
        <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: "#7C3AED", borderWidth: focused ? 3 : 2, borderColor: colors.onImage, alignItems: "center", justifyContent: "center", elevation: focused ? 6 : 0 }}>
          <Text style={{ color: colors.onImage, fontWeight: "800", fontSize: focused ? rf(15) : rf(11) }}>{label}</Text>
        </View>
        {focused ? <View style={{ width: 0, height: 0, borderLeftWidth: rs(7), borderRightWidth: rs(7), borderTopWidth: rs(9), borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: colors.onImage, marginTop: -1 }} /> : null}
      </View>
    );
  }
  if (kind === "guest") {
    return (
      <View style={{ width: rs(32), height: rs(32), borderRadius: radius.pill, backgroundColor: "#7C3AED", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.onImage }}>
        <MaterialCommunityIcons name="walk" size={rs(16)} color={colors.onImage} />
      </View>
    );
  }
  if (kind === "office") {
    return (
      <View style={{ width: rs(28), height: rs(28), borderRadius: rs(8), backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.onInk }}>
        <Ionicons name="business" size={rs(14)} color={colors.onInk} />
      </View>
    );
  }
  const color = kind === "pickup" ? "#7C3AED" : colors.green;
  return (
    <View style={{ width: rs(30), height: rs(30), borderRadius: radius.pill, backgroundColor: color + "33", alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: rs(16), height: rs(16), borderRadius: radius.pill, backgroundColor: color, borderWidth: 3, borderColor: colors.onImage }} />
    </View>
  );
}

// The moving vehicle. self = your own position (navigation arrow), otherwise the host's car or bike.
function Vehicle({ type, heading, self }) {
  const { colors, radius, rs } = useTheme();
  if (self) {
    return (
      <View style={{ width: rs(44), height: rs(44), borderRadius: radius.pill, backgroundColor: colors.primary + "33", alignItems: "center", justifyContent: "center" }}>
        <MaterialCommunityIcons name="navigation" size={rs(28)} color={colors.primary} style={{ transform: [{ rotate: `${heading}deg` }] }} />
      </View>
    );
  }
  return (
    <View style={{ width: rs(40), height: rs(40), borderRadius: radius.pill, backgroundColor: colors.route, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.background }}>
      <MaterialCommunityIcons name={type === "bike" ? "motorbike" : "car"} size={rs(20)} color={colors.background} />
    </View>
  );
}

// Shown instead of the map when .env has no Mapbox token (e.g. a fresh clone of the repo).
export function NoMapToken() {
  const { colors, spacing, rs } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.sm }}>
      <Ionicons name="map-outline" size={rs(32)} color={colors.textMuted} />
      <Text style={{ color: colors.textMuted, textAlign: "center" }}>Add EXPO_PUBLIC_MAPBOX_TOKEN to .env to show the map.</Text>
    </View>
  );
}

// route: the full line (null while it loads); done: the part already driven (shown grey)
// pins: [{ id, kind, coords, label?, focused?, onPress? }]; vehicle: { point, heading, type, self }; walks: dotted walking lines
// padding: space taken by cards on top / bottom; fit: points to frame (default: route + pins + walks) — pass a fixed list
// so the camera stays still while the route or pins change.
export default function LiveMap({ route, done, pins = [], vehicle, walks = [], padding: givenPadding, fit }) {
  const { colors, rs } = useTheme();
  const padding = givenPadding ?? { top: rs(160), bottom: rs(300), left: rs(40), right: rs(40) };
  const scheme = useColorScheme();
  const camera = useRef(null);
  const [located, setLocated] = useState(false); // location allowed: show your blue dot
  const [onMe, setOnMe] = useState(false); // map is centred on you (button then shows the whole trip)
  useEffect(() => {
    Location.getForegroundPermissionsAsync()
      .then((p) => setLocated(p.granted))
      .catch(() => {});
  }, []);
  // Fit the route, pins and walks; re-fit only when they actually change (e.g. your GPS arrives), not on every car move.
  const box = route ? boundsOf(fit ?? [...route, ...pins.map((p) => p.coords), ...walks.flat()]) : null;
  const boxKey = box ? box.map((n) => n.toFixed(5)).join(",") : "";
  const view = useMemo(() => {
    if (!boxKey) return null;
    return {
      bounds: toBounds(boxKey.split(",").map(Number)),
      padding: { paddingTop: padding.top, paddingBottom: padding.bottom, paddingLeft: padding.left, paddingRight: padding.right },
    };
  }, [boxKey, padding.top, padding.bottom, padding.left, padding.right]);
  // Recenter button: first tap moves to where you are, next tap shows the whole trip again.
  function refit() {
    if (!view || onMe) return;
    camera.current?.setCamera({ bounds: view.bounds, padding: view.padding, animationDuration: 0 });
  }

  async function recenter() {
    if (!view) return;
    if (onMe) {
      camera.current?.setCamera({ bounds: view.bounds, padding: view.padding, animationDuration: 600 });
      return setOnMe(false);
    }
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) return Alert.alert("Location is off", "Allow location access in Settings to see where you are on the map.");
      setLocated(true);
      const p = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      camera.current?.setCamera({ centerCoordinate: [p.coords.longitude, p.coords.latitude], zoomLevel: 16, animationDuration: 600 });
      setOnMe(true);
    } catch {
      Alert.alert("Couldn’t find you", "Check that location is turned on, then try again.");
    }
  }
  // The bottom card shows the recenter button (see MapSheet); tell it what to do.
  useEffect(() => (view ? registerMap({ onMe, recenter }) : undefined));

  if (!hasMapboxToken) return <NoMapToken />;
  if (!route) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }} accessibilityLabel="Loading the route">
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }
  const line = { lineCap: "round", lineJoin: "round", lineWidth: 6 };


  return (
    <View style={{ flex: 1 }} onLayout={refit}>
      {/* Re-frame once the map has loaded and whenever its size changes: the first fit can use the wrong size while the screen lays out. */}
      <MapView style={{ flex: 1 }} styleURL={scheme === "dark" ? MAP_STYLES.dark : MAP_STYLES.light} scaleBarEnabled={false} compassEnabled={false} onDidFinishLoadingMap={refit}>
        {/* defaultSettings frames the first view; bounds re-frames when the route or pins change. */}
        <Camera ref={camera} defaultSettings={{ bounds: view.bounds, padding: view.padding }} bounds={view.bounds} padding={view.padding} animationDuration={500} />
        {located ? <UserLocation visible /> : null}
        <ShapeSource id="route" shape={lineFeature(route)}>
          <LineLayer id="route-line" style={{ ...line, lineColor: colors.route }} />
        </ShapeSource>
        {done && done.length > 1 ? (
          <ShapeSource id="done" shape={lineFeature(done)}>
            <LineLayer id="done-line" style={{ ...line, lineColor: colors.textMuted, lineOpacity: 0.7 }} />
          </ShapeSource>
        ) : null}
        {walks.map((w, i) => (
          <ShapeSource key={i} id={`walk-${i}`} shape={lineFeature(w)}>
            <LineLayer id={`walk-line-${i}`} style={{ lineCap: "round", lineWidth: 5, lineColor: colors.textMuted, lineDasharray: [0, 2] }} />
          </ShapeSource>
        ))}
        {/* Focused pin last so it's drawn on top; its pointer tip sits on the exact spot. */}
        {[...pins.filter((p) => !p.focused), ...pins.filter((p) => p.focused)].map((p) => (
          <MarkerView key={p.id} coordinate={p.coords} allowOverlap anchor={p.focused ? { x: 0.5, y: 1 } : { x: 0.5, y: 0.5 }}>
            {p.onPress ? (
              <Pressable onPress={p.onPress} accessibilityRole="button" accessibilityLabel={p.a11y} hitSlop={8}>
                <Pin kind={p.kind} label={p.label} focused={p.focused} />
              </Pressable>
            ) : (
              <Pin kind={p.kind} label={p.label} focused={p.focused} />
            )}
          </MarkerView>
        ))}
        {vehicle ? (
          <MarkerView coordinate={vehicle.point} allowOverlap>
            <Vehicle type={vehicle.type} heading={vehicle.heading} self={vehicle.self} />
          </MarkerView>
        ) : null}
      </MapView>
    </View>
  );
}
