import { useEffect, useRef, useState } from "react";
import { along } from "./route";

// Moves a point along `coords` over `durationMs`. Pass null coords to wait (e.g. while the route loads).
// shortcut: simulated movement for the demo; replace with the host's real location from GET /v1/rides/{id}/live every 5 s.
export function useMovement(coords, durationMs, { onNear, nearAt = 0.8, onArrive } = {}) {
  // Progress belongs to one route: a new route starts at 0 (not where the last one ended) until its first tick.
  const [progress, setProgress] = useState({ coords: null, t: 0 });
  const t = progress.coords === coords ? progress.t : 0;
  const fired = useRef({ near: false, arrive: false });
  const callbacks = useRef({ onNear, onArrive });
  useEffect(() => {
    callbacks.current = { onNear, onArrive };
  });

  useEffect(() => {
    if (!coords) return;
    fired.current = { near: false, arrive: false };
    const start = Date.now();
    const id = setInterval(() => {
      const next = Math.min(1, (Date.now() - start) / durationMs);
      setProgress({ coords, t: next });
      if (next >= nearAt && !fired.current.near) {
        fired.current.near = true;
        callbacks.current.onNear?.();
      }
      if (next >= 1) {
        clearInterval(id);
        if (!fired.current.arrive) {
          fired.current.arrive = true;
          callbacks.current.onArrive?.(coords); // which route finished, so a late timer can't mark the next one
        }
      }
    }, 120);
    return () => clearInterval(id);
  }, [coords, durationMs, nearAt]);

  return coords ? { t, ...along(coords, t) } : { t: 0, point: null, heading: 0, done: [] };
}
