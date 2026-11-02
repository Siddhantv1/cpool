// The live ride card in the notification shade (Android only; see modules/cpool-live).
// Missing on iPhone and on app builds made before the module existed, so every call is a no-op there.
import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

const Live = Platform.OS === "android" ? requireOptionalNativeModule("CpoolLive") : null;

// The car or bike on the card is drawn in the vehicle's colour, read from its name ("Red Maruti Swift").
const COLOURS = { red: "#D12B2B", blue: "#1D4ED8", black: "#1F2937", white: "#9CA3AF", silver: "#94A3B8", grey: "#6B7280", gray: "#6B7280" };
export const vehicleColour = (name = "") => COLOURS[Object.keys(COLOURS).find((c) => name.toLowerCase().includes(c))] ?? "#0E6464";

// o: { title, text, sub, chip, progress (0-100), vehicle, color, phone, share, url }
export function showLiveRide(o) {
  try {
    Live?.show(o);
  } catch {}
}
export function endLiveRide() {
  try {
    Live?.cancel();
  } catch {}
}
