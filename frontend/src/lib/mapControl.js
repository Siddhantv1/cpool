// Lets the bottom card (MapSheet) show the map's recenter button right above itself, wherever the card is.
// The map (LiveMap) registers what the button does; the newest map on screen wins.
import { useEffect, useState } from "react";

const maps = [];
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(maps[maps.length - 1] ?? null));

// control: { onMe, recenter }. Returns a function that unregisters it.
export function registerMap(control) {
  maps.push(control);
  emit();
  return () => {
    const i = maps.indexOf(control);
    if (i >= 0) maps.splice(i, 1);
    emit();
  };
}

// The control of the map currently on screen, or null.
export function useMapControl() {
  const [control, setControl] = useState(maps[maps.length - 1] ?? null);
  useEffect(() => {
    listeners.add(setControl);
    return () => listeners.delete(setControl);
  }, []);
  return control;
}
