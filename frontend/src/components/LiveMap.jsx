import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Camera, LineLayer, MapView, MarkerView, ShapeSource } from "@rnmapbox/maps";
import { useMemo } from "react";
import { ActivityIndicator, Text, useColorScheme, View } from "react-native";
import { useTheme } from "../constants/theme";
import { hasMapboxToken, MAP_STYLES, toBounds } from "../lib/mapbox";
import { boundsOf, lineFeature } from "../lib/route";

// A pin on the map. kind: "start" | "pickup" | "office" | "guest" (a colleague walking to the pickup)
function Pin({ kind }) {
  const { colors, radius, rs } = useTheme();
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

// route: the full line (null while it loads); done: the part already driven (shown grey); pins: [{ id, kind, coords }]
// vehicle: { point, heading, type, self }; walks: dotted walking lines; padding: space taken by cards on top / bottom
export default function LiveMap({ route, done, pins = [], vehicle, walks = [], padding: givenPadding }) {
  const { colors, rs } = useTheme();
  const padding = givenPadding ?? { top: rs(160), bottom: rs(300), left: rs(40), right: rs(40) };
  const scheme = useColorScheme();
  // Fit the route, pins and walks; re-fit only when they actually change (e.g. your GPS arrives), not on every car move.
  const box = route ? boundsOf([...route, ...pins.map((p) => p.coords), ...walks.flat()]) : null;
  const boxKey = box ? box.map((n) => n.toFixed(5)).join(",") : "";
  const view = useMemo(() => {
    if (!boxKey) return null;
    return {
      bounds: toBounds(boxKey.split(",").map(Number)),
      padding: { paddingTop: padding.top, paddingBottom: padding.bottom, paddingLeft: padding.left, paddingRight: padding.right },
    };
  }, [boxKey, padding.top, padding.bottom, padding.left, padding.right]);
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
    <MapView style={{ flex: 1 }} styleURL={scheme === "dark" ? MAP_STYLES.dark : MAP_STYLES.light} scaleBarEnabled={false} compassEnabled={false}>
      <Camera bounds={view.bounds} padding={view.padding} animationDuration={500} />
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
      {pins.map((p) => (
        <MarkerView key={p.id} coordinate={p.coords} allowOverlap>
          <Pin kind={p.kind} />
        </MarkerView>
      ))}
      {vehicle ? (
        <MarkerView coordinate={vehicle.point} allowOverlap>
          <Vehicle type={vehicle.type} heading={vehicle.heading} self={vehicle.self} />
        </MarkerView>
      ) : null}
    </MapView>
  );
}
