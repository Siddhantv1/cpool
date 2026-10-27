import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Camera, LineLayer, MapView, MarkerView, ShapeSource } from "@rnmapbox/maps";
import { Text, useColorScheme, View } from "react-native";
import { useTheme } from "../constants/theme";
import { hasMapboxToken, MAP_STYLES, toBounds } from "../lib/mapbox";
import { boundsOf, lineFeature } from "../lib/route";

// A pin on the map. kind: "start" | "pickup" | "office"
function Pin({ kind }) {
  const { colors, radius } = useTheme();
  if (kind === "office") {
    return (
      <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.onInk }}>
        <Ionicons name="business" size={14} color={colors.onInk} />
      </View>
    );
  }
  const color = kind === "pickup" ? "#7C3AED" : colors.green;
  return (
    <View style={{ width: 30, height: 30, borderRadius: radius.pill, backgroundColor: color + "33", alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: 16, height: 16, borderRadius: radius.pill, backgroundColor: color, borderWidth: 3, borderColor: colors.onImage }} />
    </View>
  );
}

// The moving vehicle. self = your own position (navigation arrow), otherwise the host's car or bike.
function Vehicle({ type, heading, self }) {
  const { colors, radius } = useTheme();
  if (self) {
    return (
      <View style={{ width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.green + "33", alignItems: "center", justifyContent: "center" }}>
        <MaterialCommunityIcons name="navigation" size={28} color={colors.green} style={{ transform: [{ rotate: `${heading}deg` }] }} />
      </View>
    );
  }
  return (
    <View style={{ width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.route, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.background }}>
      <MaterialCommunityIcons name={type === "bike" ? "motorbike" : "car"} size={20} color={colors.background} />
    </View>
  );
}

// Shown instead of the map when .env has no Mapbox token (e.g. a fresh clone of the repo).
export function NoMapToken() {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.sm }}>
      <Ionicons name="map-outline" size={32} color={colors.textMuted} />
      <Text style={{ color: colors.textMuted, textAlign: "center" }}>Add EXPO_PUBLIC_MAPBOX_TOKEN to .env to show the map.</Text>
    </View>
  );
}

// route: the full line; done: the part already driven (shown grey); pins: [{ id, kind, coords }]
// vehicle: { point, heading, type, self }; walks: dotted walking lines; padding: space taken by cards on top / bottom
export default function LiveMap({ route, done, pins = [], vehicle, walks = [], padding = { top: 160, bottom: 300, left: 40, right: 40 } }) {
  const { colors } = useTheme();
  const scheme = useColorScheme();
  if (!hasMapboxToken) return <NoMapToken />;
  const bounds = toBounds(boundsOf([...route, ...pins.map((p) => p.coords), ...walks.flat()]));
  const line = { lineCap: "round", lineJoin: "round", lineWidth: 6 };

  return (
    <MapView style={{ flex: 1 }} styleURL={scheme === "dark" ? MAP_STYLES.dark : MAP_STYLES.light} scaleBarEnabled={false} compassEnabled={false}>
      <Camera defaultSettings={{ bounds, padding: { paddingTop: padding.top, paddingBottom: padding.bottom, paddingLeft: padding.left, paddingRight: padding.right } }} />
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
