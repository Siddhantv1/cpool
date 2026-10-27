import { useEffect, useRef, useState } from "react";
import { along } from "./route";

// Moves a point along `coords` over `durationMs`.
// shortcut: simulated movement for the demo; replace with the host's real location from GET /v1/rides/{id}/live every 5 s.
export function useMovement(coords, durationMs, { onNear, nearAt = 0.8, onArrive } = {}) {
  const [t, setT] = useState(0);
  const fired = useRef({ near: false, arrive: false });
  const callbacks = useRef({ onNear, onArrive });
  useEffect(() => {
    callbacks.current = { onNear, onArrive };
  });

  useEffect(() => {
    fired.current = { near: false, arrive: false };
    const start = Date.now();
    const id = setInterval(() => {
      const next = Math.min(1, (Date.now() - start) / durationMs);
      setT(next);
      if (next >= nearAt && !fired.current.near) {
        fired.current.near = true;
        callbacks.current.onNear?.();
      }
      if (next >= 1) {
        clearInterval(id);
        if (!fired.current.arrive) {
          fired.current.arrive = true;
          callbacks.current.onArrive?.();
        }
      }
    }, 120);
    return () => clearInterval(id);
  }, [coords, durationMs, nearAt]);

  return { t, ...along(coords, t) };
}
