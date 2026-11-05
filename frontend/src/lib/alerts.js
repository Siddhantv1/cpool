// Ride alerts: a short sound plus a vibration (accepted, cancelled, host nearby).
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { playNativeSound } from "./live";
import { getSession } from "./session";

const FILES = {
  accepted: require("../../assets/sounds/accepted.wav"),
  cancelled: require("../../assets/sounds/cancelled.wav"),
  nearby: require("../../assets/sounds/nearby.wav"),
};
const audioReady = Platform.OS === "ios" ? setAudioModeAsync({ playsInSilentMode: false, shouldPlayInBackground: false, interruptionMode: "mixWithOthers" }).catch(() => {}) : null;
export function playAlert(name) {
  if (getSession()?.soundsOff) return;
  try {
    // Android: played as a sound effect by the native module, because an audio player holds a media session that
    // makes the phone show Cpool as a music player ("Unknown song") and hide the live ride card.
    // iPhone: a fresh player each time, removed once the sound (under 1 s) is done.
    if (!playNativeSound(name)) {
      Promise.resolve(audioReady).then(() => {
        const player = createAudioPlayer(FILES[name]);
        player.play();
        setTimeout(() => player.remove(), 3000);
      }).catch(() => {});
    }
  } catch {
    // A missing sound must never break the screen; the vibration below still runs.
  }
  const type = name === "cancelled" ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success;
  Haptics.notificationAsync(type).catch(() => {});
}
