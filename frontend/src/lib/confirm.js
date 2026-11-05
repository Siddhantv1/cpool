// "Are you sure?" bottom sheet (approved design), callable from any screen or from lib code. The sheet itself is
// components/ConfirmSheet.jsx, mounted once in app/_layout.jsx.
// opts: { title, text, note?, reasons?, reasonLabel?, other?, tip?, keep, confirm, icon?, onConfirm(reason) }
//   reasons: pick one before the red button turns on; other: the reason that asks for a few words ("Something else").
import { useEffect, useState } from "react";

const listeners = new Set();

export function confirmSheet(opts) {
  listeners.forEach((fn) => fn(opts));
}

export function useConfirmSheet() {
  const [opts, setOpts] = useState(null);
  useEffect(() => {
    listeners.add(setOpts);
    return () => listeners.delete(setOpts);
  }, []);
  return [opts, () => setOpts(null)];
}
