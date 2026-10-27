import * as Location from "expo-location";
import { useEffect, useState } from "react";

// The area name for "Your location" (e.g. "HSR Layout"). Falls back gracefully if location is off.
export function useArea() {
  const [area, setArea] = useState({ label: "Finding you…", coords: null, ok: false });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { granted } = await Location.requestForegroundPermissionsAsync();
        if (!granted) return alive && setArea({ label: "Set your pickup", coords: null, ok: false });
        const pos = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        const [place] = await Location.reverseGeocodeAsync(pos.coords);
        const name = [place?.district || place?.subregion || place?.city, place?.street].filter(Boolean).join(" · ");
        if (alive) setArea({ label: name || "Current location", coords: [pos.coords.longitude, pos.coords.latitude], ok: true });
      } catch {
        if (alive) setArea({ label: "Set your pickup", coords: null, ok: false });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return area;
}
