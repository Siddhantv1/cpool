import { Ionicons } from "@expo/vector-icons";
import { Camera, LineLayer, MapView, MarkerView, ShapeSource, UserLocation } from "@rnmapbox/maps";
import * as Location from "expo-location";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, useColorScheme, View } from "react-native";
import { useTheme } from "../constants/theme";
import { hasMapboxToken, MAP_STYLES, toBounds } from "../lib/mapbox";
import { boundsOf, lineFeature } from "../lib/route";
import { MapAttribution, NoMapToken } from "./LiveMap";

const BENGALURU = [77.6408, 12.9352];

// Home's full-screen map: rides near you (guest) or your route with seat requests (host), plus a my-location button.
// markers: [{ id, coords, node }]: node is centred on coords (MarkerView's anchor prop hid markers on Android, so a node
// that points at its spot pads its bottom by its own height); route: optional line; fit: points to frame;
// padding: room taken by the top bar and the bottom sheet; locateBottom: where the my-location button sits.
export default function HomeMap({ markers = [], route, fit = [], padding, locateBottom }) {
  const { colors, rs } = useTheme();
  const scheme = useColorScheme();
  const camera = useRef(null);
  const [located, setLocated] = useState(false);
  useEffect(() => {
    Location.getForegroundPermissionsAsync()
      .then((p) => setLocated(p.granted))
      .catch(() => {});
  }, []);

  // Re-frame only when the points really change (not on every render).
  const boxKey = fit.length > 1 ? boundsOf(fit).map((n) => n.toFixed(5)).join(",") : "";
  const view = useMemo(() => {
    if (!boxKey) return null;
    return {
      bounds: toBounds(boxKey.split(",").map(Number)),
      padding: { paddingTop: padding.top, paddingBottom: padding.bottom, paddingLeft: padding.left, paddingRight: padding.right },
    };
  }, [boxKey, padding.top, padding.bottom, padding.left, padding.right]);

  async function locate() {
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) return Alert.alert("Location is off", "Allow location access in Settings to see where you are on the map.");
      setLocated(true);
      const p = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      camera.current?.setCamera({ centerCoordinate: [p.coords.longitude, p.coords.latitude], zoomLevel: 15, padding: view?.padding, animationDuration: 600 });
    } catch {
      Alert.alert("Couldn’t find you", "Check that location is turned on, then try again.");
    }
  }

  if (!hasMapboxToken) return <NoMapToken />;
  return (
    <View style={{ flex: 1 }}>
      {/* Remounted when the set of markers changes: markers added to an already-mounted map didn't show on Android
          (emulator). The set changes rarely: rides load, Guest/Host switch, a request arrives or is answered. */}
      <MapView key={markers.map((m) => m.id).join(",")} style={{ flex: 1 }} styleURL={scheme === "dark" ? MAP_STYLES.dark : MAP_STYLES.light} scaleBarEnabled={false} compassEnabled={false} attributionEnabled={false}>
        {view ? (
          <Camera ref={camera} defaultSettings={{ bounds: view.bounds, padding: view.padding }} bounds={view.bounds} padding={view.padding} animationDuration={500} />
        ) : (
          <Camera ref={camera} defaultSettings={{ centerCoordinate: BENGALURU, zoomLevel: 11 }} />
        )}
        {located ? <UserLocation visible /> : null}
        {route?.length > 1 ? (
          <ShapeSource id="home-route" shape={lineFeature(route)}>
            <LineLayer id="home-route-line" style={{ lineCap: "round", lineJoin: "round", lineWidth: 6, lineColor: colors.route }} />
          </ShapeSource>
        ) : null}
        {markers.map((m) => (
          <MarkerView key={m.id} coordinate={m.coords} allowOverlap>
            {m.node}
          </MarkerView>
        ))}
      </MapView>
      <MapAttribution />
      <Pressable
        onPress={locate}
        accessibilityRole="button"
        accessibilityLabel="Show my location"
        hitSlop={6}
        style={{ position: "absolute", right: rs(14), bottom: locateBottom, width: rs(44), height: rs(44), borderRadius: rs(22), backgroundColor: colors.background, alignItems: "center", justifyContent: "center", elevation: 4, shadowColor: "#0F141E", shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}
      >
        <Ionicons name="locate" size={rs(20)} color={colors.text} />
      </Pressable>
    </View>
  );
}
