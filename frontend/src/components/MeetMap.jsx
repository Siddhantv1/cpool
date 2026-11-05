import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Camera, CircleLayer, LineLayer, MapView, MarkerView, ShapeSource } from "@rnmapbox/maps";
import { useRef } from "react";
import { Text, useColorScheme, View } from "react-native";
import { fonts, useTheme } from "../constants/theme";
import { hasMapboxToken, MAP_STYLES, STREET_STYLE, toBounds } from "../lib/mapbox";
import { boundsOf, lineFeature } from "../lib/route";
import { MapAttribution, NoMapToken } from "./LiveMap";

const spot = (id, coords) => ({ type: "Feature", properties: { id }, geometry: { type: "Point", coordinates: coords } });

// Small street map on the Accepted screen (approved round 3): the host's road in blue, your walk to the pickup point as
// purple dots with its minutes, the pickup point with its time, and you. Not interactive; the card's Walk button opens
// directions. walk: the walking line, or null when the host passes your spot. padding: room for the card's own panel.
export default function MeetMap({ route, walk, meet, me, time, type, minutes, padding }) {
  const { colors, rs, rf } = useTheme();
  const dark = useColorScheme() === "dark";
  const camera = useRef(null);
  if (!hasMapboxToken) return <NoMapToken />;
  const view = walk ? { bounds: toBounds(boundsOf([...walk, meet, me])), padding } : { centerCoordinate: meet, zoomLevel: 16, padding };
  // The walk's minutes sit at your dot, away from the pickup pin: above it, or beside it when the walk runs up and down
  // the map (above could land on the pin, below under the card's panel).
  const upright = Math.abs(me[1] - meet[1]) > Math.abs(me[0] - meet[0]) * Math.cos((meet[1] * Math.PI) / 180);
  const tag = rs(30);
  const tip = rs(6);
  const lift = rs(12); // gap so the pointer's tip sits just above the pin's ring
  const pill = rs(26);
  const clear = rs(20); // clear of your dot's halo
  const is = (id) => ["==", ["get", "id"], id];

  return (
    <View style={{ flex: 1 }}>
      <MapView
        key={`${meet}${walk ? "-walk" : ""}`}
        style={{ flex: 1 }}
        styleURL={dark ? MAP_STYLES.dark : STREET_STYLE}
        surfaceView={false} // TextureView, so the card's rounded corners clip the map on Android
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        scaleBarEnabled={false}
        compassEnabled={false}
        // Mapbox's logo must stay visible (their terms; no smaller size exists): top-left, clear of the card's panel.
        // Their (i) button is off like on every map; the text attribution below replaces it (see MapAttribution).
        logoPosition={{ top: rs(8), left: rs(8) }}
        attributionEnabled={false}
        onDidFinishLoadingMap={() => camera.current?.setCamera({ ...view, animationDuration: 0 })}
      >
        <Camera ref={camera} defaultSettings={view} {...view} maxZoomLevel={17} animationDuration={0} />
        <ShapeSource id="meet-route" shape={lineFeature(route)}>
          <LineLayer id="meet-route-casing" style={{ lineColor: colors.background, lineWidth: 10, lineCap: "round", lineJoin: "round", lineOpacity: 0.9 }} />
          <LineLayer id="meet-route-line" style={{ lineColor: colors.route, lineWidth: 6, lineCap: "round", lineJoin: "round" }} />
        </ShapeSource>
        {walk ? (
          <ShapeSource id="meet-walk" shape={lineFeature(walk)}>
            <LineLayer id="meet-walk-line" style={{ lineColor: colors.purple, lineWidth: 5, lineCap: "round", lineDasharray: [0, 2] }} />
          </ShapeSource>
        ) : null}
        <ShapeSource id="meet-spots" shape={{ type: "FeatureCollection", features: walk ? [spot("me", me), spot("meet", meet)] : [spot("meet", meet)] }}>
          <CircleLayer id="meet-me-halo" filter={is("me")} style={{ circleRadius: 16, circleColor: colors.primary, circleOpacity: 0.18 }} />
          <CircleLayer id="meet-me" filter={is("me")} style={{ circleRadius: 7, circleColor: colors.primary, circleStrokeWidth: 3, circleStrokeColor: colors.background }} />
          <CircleLayer id="meet-pin" filter={is("meet")} style={{ circleRadius: 8, circleColor: colors.onInk, circleStrokeWidth: 5, circleStrokeColor: colors.ink }} />
        </ShapeSource>
        {/* No anchor props (they hid markers on Android): an empty half under each label puts the point where it belongs. */}
        <MarkerView coordinate={meet} allowOverlap>
          <View pointerEvents="none" style={{ height: 2 * (tag + tip + lift), alignItems: "center" }}>
            <View style={{ height: tag, flexDirection: "row", alignItems: "center", gap: rs(5), backgroundColor: colors.ink, borderRadius: rs(10), paddingHorizontal: rs(10) }}>
              <MaterialCommunityIcons name={type === "bike" ? "motorbike" : "car"} size={rs(15)} color={colors.onInk} />
              <Text style={{ color: colors.onInk, fontFamily: fonts.bold, fontSize: rf(13) }}>Pickup {time}</Text>
            </View>
            <View style={{ width: 0, height: 0, borderLeftWidth: tip, borderRightWidth: tip, borderTopWidth: tip, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: colors.ink }} />
          </View>
        </MarkerView>
        {walk ? (
          <MarkerView coordinate={me} allowOverlap>
            <View
              pointerEvents="none"
              style={upright ? { width: 2 * rs(110), flexDirection: "row", alignItems: "center", paddingLeft: rs(110) + clear } : { height: 2 * (pill + clear), alignItems: "center" }}
            >
              <View style={{ height: pill, flexDirection: "row", alignItems: "center", gap: rs(3), backgroundColor: colors.background, borderRadius: pill / 2, borderWidth: 1, borderColor: colors.line, paddingHorizontal: rs(9) }}>
                <MaterialCommunityIcons name="walk" size={rs(14)} color={colors.purple} />
                <Text style={{ color: colors.purple, fontFamily: fonts.bold, fontSize: rf(12.5) }}>{minutes} min</Text>
              </View>
            </View>
          </MarkerView>
        ) : null}
      </MapView>
      <MapAttribution at={{ top: rs(8), right: rs(8) }} />
    </View>
  );
}
