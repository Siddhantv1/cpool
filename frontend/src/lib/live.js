// The live ride card in the notification shade (Android only; see modules/cpool-live).
// Missing on iPhone and on app builds made before the module existed, so every call is a no-op there.
import { requireOptionalNativeModule } from "expo-modules-core";
import { AppRegistry, Platform } from "react-native";
import { askWith } from "./notify";

const Live = Platform.OS === "android" ? requireOptionalNativeModule("CpoolLive") : null;

// Host driving: React Native pauses the app's timers in the background unless a background task is running. This one
// never finishes by itself; the native side starts it on Start ride and ends it with the ride, so the drive, the card
// and the island keep updating while the host is in Google Maps.
if (Live) AppRegistry.registerHeadlessTask("CpoolRide", () => () => new Promise(() => {}));

// Host taps Start ride: the ride service and background task start now, while Cpool is still on screen (the phone
// may pause Cpool once it's in the background, before they'd get going). Safe to call again; ended by endLiveRide.
export function startRide(title) {
  try {
    Live?.startRide?.(title ?? null);
  } catch {}
}

// Host island ("Display over other apps"): allowed? / open Android's switch / its buttons ({ action: "pickedup", id }).
export function canShowIsland() {
  try {
    return !!Live?.canShowIsland?.();
  } catch {
    return false;
  }
}
export function openIslandSettings() {
  try {
    Live?.openIslandSettings?.();
  } catch {}
}
export function onIslandAction(fn) {
  const sub = Live?.addListener?.("onIslandAction", fn);
  return () => sub?.remove();
}
// Every second during a ride, from Android: JS timers stop when Cpool has nothing on screen (e.g. phone locked).
export function onRideTick(fn) {
  const sub = Live?.addListener?.("onRideTick", fn);
  return () => sub?.remove();
}
// A line in Android's log (tag CpoolLive): used when a card update fails, so a broken update is never silent again.
function liveLog(message) {
  try {
    Live?.log?.(message);
  } catch {}
}
// Phones with their own island (Android 16.1+, vivo / iQOO on Android 16) show the ride there, so Cpool's own pill
// and its "Display over other apps" question aren't needed.
export function hasSystemIsland() {
  try {
    return !!Live?.hasSystemIsland?.();
  } catch {
    return false;
  }
}
// Asked once per app start, on the Drive screen, with the next pickup in the preview pill ("Karthik · 6 min").
let askedIsland = false;
export function maybeAskForIsland(pill) {
  if (askedIsland || !Live?.canShowIsland || canShowIsland() || hasSystemIsland()) return;
  askedIsland = true;
  askWith({
    title: "See your next pickup over Maps",
    text: "A small Cpool pill floats over Google Maps with who’s next and how far. Tap it for the full card.",
    pill,
    button: "Allow display over other apps",
    onAllow: openIslandSettings,
  });
}

// The car or bike on the card is drawn in the vehicle's colour, read from its name ("Red Maruti Swift"); brand blue
// (the demo's host car) when the name has no colour.
const COLOURS = { red: "#D12B2B", blue: "#1D4ED8", black: "#1F2937", white: "#9CA3AF", silver: "#94A3B8", grey: "#6B7280", gray: "#6B7280" };
export const vehicleColour = (name = "") => COLOURS[Object.keys(COLOURS).find((c) => name.toLowerCase().includes(c))] ?? "#1D4ED8";

// o: { style ("live" = Android's Live Update | "card" = Cpool-drawn demo card), title, text, sub, when (card), chip (live),
//      progress (0-100, where the car is), vehicle, color, tile ("vehicle" | "face"), gender,
//      segments: [{ length, color }] (from liveBar), points: [{ at, color }], labels: [{ at, text }] (card), phone, callLabel, share, url }
export function showLiveRide(o) {
  try {
    // JSON round trip drops undefined values (e.g. no Picked up guest while driving): the native side rejects a whole
    // update that contains one, which left the island and card stuck until the next arrival.
    Live?.show(JSON.parse(JSON.stringify(o)));
  } catch (e) {
    liveLog(`show failed: ${e?.message ?? e}`);
  }
}
export function endLiveRide() {
  try {
    Live?.cancel();
  } catch {}
}
// A ride sound played by the native module (Android). Returns false where it can't (iPhone, older builds).
export function playNativeSound(name) {
  try {
    if (!Live?.play) return false;
    Live.play(name);
    return true;
  } catch {
    return false;
  }
}
