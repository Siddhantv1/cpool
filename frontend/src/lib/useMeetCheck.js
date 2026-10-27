import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { km } from "./route";

const ARRIVED_M = 50;

// Watches your phone's GPS while you walk to the meet point: where you are, metres left, and whether you've
// arrived (within 50 m). Only while the screen is open; nothing runs in the background.
// shortcut: progress stays on this phone; send it with POST /v1/rides/{id}/locations so the host sees it live.
export function useMeetCheck(meet) {
  const [state, setState] = useState({ here: null, metersLeft: null, arrived: false, allowed: true });
  const meetKey = meet ? meet.join(",") : "";

  useEffect(() => {
    if (!meetKey) return;
    const target = meetKey.split(",").map(Number);
    let sub = null;
    let alive = true;
    (async () => {
      try {
        const { granted } = await Location.requestForegroundPermissionsAsync();
        if (!granted) return alive && setState((s) => ({ ...s, allowed: false }));
        sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 3000 }, (p) => {
          const here = [p.coords.longitude, p.coords.latitude];
          const metersLeft = Math.round(km(here, target) * 1000);
          setState((s) => {
            const arrived = s.arrived || metersLeft <= ARRIVED_M;
            if (arrived && !s.arrived) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            return { here, metersLeft, arrived, allowed: true };
          });
        });
        if (!alive) sub.remove();
      } catch {
        if (alive) setState((s) => ({ ...s, allowed: false }));
      }
    })();
    return () => {
      alive = false;
      sub?.remove();
    };
  }, [meetKey]);

  return state;
}
