// Ride alerts: a short sound plus a vibration (accepted, cancelled, host nearby).
import { createAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { getSession } from "./session";

const FILES = {
  accepted: require("../../assets/sounds/accepted.wav"),
  cancelled: require("../../assets/sounds/cancelled.wav"),
  nearby: require("../../assets/sounds/nearby.wav"),
};
const players = {};

export function playAlert(name) {
  if (getSession()?.soundsOff) return;
  try {
    players[name] ??= createAudioPlayer(FILES[name]);
    players[name].seekTo(0);
    players[name].play();
  } catch {
    // A missing sound must never break the screen; the vibration below still runs.
  }
  const type = name === "cancelled" ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success;
  Haptics.notificationAsync(type).catch(() => {});
}
