// Notifications: reminders scheduled on this phone (work offline) and ride alerts with buttons.
// shortcut: ride alerts are sent from the phone for the example data; once the backend sends push (PUT /v1/me/devices),
// they arrive from the server with the same channels, buttons and data.
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { AppState, Linking, Platform } from "react-native";

// Android categories: each one can be muted on its own in Settings → Apps → Cpool → Notifications.
// (The "Live ride" category is created by the live card's native module, modules/cpool-live.)
const CHANNELS = {
  ride: ["Ride updates", "Accepted, arrived, declined, cancelled"],
  requests: ["Seat requests", "For hosts · Accept / Decline"],
  guests: ["Guest updates", "For hosts · waiting at pickup, in the car"],
  reminders: ["Reminders", "15 min before every ride"],
};
const BUTTONS = {
  "ride-accepted": [["view", "View ride"], ["call", "Call"]],
  "seat-request": [["accept", "Accept"], ["decline", "Decline"]],
  "pickup-reminder": [["walk", "Walk directions"], ["track", "Track ride"]],
  "leave-reminder": [["start", "Start ride"]],
  arrived: [["incar", "I’m in the car"], ["call", "Call"]],
  "guest-in-car": [["pickedup", "Picked up"]],
  find: [["find", "Find a ride"]],
  "ride-cancelled": [["find", "Find another ride"]],
};
const REMIND_MIN = 15;

Notifications.setNotificationHandler({
  handleNotification: async (n) => {
    const show = n.request.content.data?.kind === "reminder" || AppState.currentState !== "active";
    return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
  },
});

// Once at start-up: channels and button sets.
export async function setupNotifications() {
  try {
    // shortcut: the example rides start empty on every launch, so reminders from an earlier run are stale.
    // With the backend, reschedule them from GET /v1/me/trip after it loads instead.
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (Platform.OS === "android") {
      await Promise.all(Object.entries(CHANNELS).map(([id, [name, description]]) => Notifications.setNotificationChannelAsync(id, { name, description, importance: AndroidImportance.HIGH })));
    }
    await Promise.all(Object.entries(BUTTONS).map(([id, list]) => Notifications.setNotificationCategoryAsync(id, list.map(([identifier, buttonTitle]) => ({ identifier, buttonTitle, options: { opensAppToForeground: true } })))));
  } catch {
    // Notifications are a nice-to-have; the app works without them.
  }
}

// A ride alert right now. Skipped while Cpool is open: the screen already shows the same change.
export function alertNow(channel, content) {
  if (AppState.currentState === "active") return;
  Notifications.scheduleNotificationAsync({ content, trigger: Platform.OS === "android" ? { channelId: channel } : null }).catch(() => {});
}

// Scheduled with Android itself, so it arrives on time even when the phone has paused Cpool in the background.
// The key is the notification's id: scheduling it again replaces it, and it can be cancelled even after the app restarts.
async function schedule(key, content, trigger) {
  try {
    await Notifications.scheduleNotificationAsync({ identifier: key, content, trigger });
  } catch {}
}
// Removes it whether it's still waiting or already in the shade, so no stale buttons are left behind.
export const cancelScheduled = (key) => Promise.all([Notifications.cancelScheduledNotificationAsync(key), Notifications.dismissNotificationAsync(key)]).catch(() => {});
// "Pickup in 15 min" / "Leave in 15 min".
export function remind(key, at, content) {
  const date = new Date(new Date(at).getTime() - REMIND_MIN * 60000);
  if (date <= new Date()) return cancelScheduled(key);
  return schedule(key, { ...content, data: { ...content.data, kind: "reminder" } }, { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: "reminders" });
}
// A ride alert in a few seconds (shortcut: how the example host's answer and requests arrive; the server pushes them later).
export function alertIn(key, channel, seconds, content) {
  return schedule(key, content, { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId: channel });
}

// Asks once per app start, at the moment it makes sense (first request or publish). copy: { title, text, preview, button?, onAllow?, pill? }
// Already allowed: asks for exact alarms instead, or Android may deliver a reminder up to an hour late.
const EXACT = { title: "Get reminders on time", text: "Allow “Alarms & reminders” so the 15-minute reminder arrives exactly on time.", preview: ["Pickup in 15 min", "Walk to the meet point"], button: "Allow alarms & reminders" };
let asked = false;
const askers = new Set();
const exactAllowed = async () => Platform.OS !== "android" || ((await Notifications.getExactAlarmPermissionsAsync().catch(() => null))?.granted ?? true);
export async function maybeAskForNotifications(copy) {
  if (asked) return;
  asked = true;
  const p = await Notifications.getPermissionsAsync().catch(() => null);
  if (!p) return;
  if (!p.granted) return void (p.canAskAgain && askers.forEach((fn) => fn(copy)));
  if (!(await exactAllowed())) askers.forEach((fn) => fn(EXACT));
}
// Shows the same bottom sheet for another permission. copy: { title, text, button, onAllow, preview? | pill? }
export const askWith = (copy) => askers.forEach((fn) => fn(copy));
export function useNotificationAsk() {
  const [copy, setCopy] = useState(null);
  useEffect(() => {
    askers.add(setCopy);
    return () => askers.delete(setCopy);
  }, []);
  return [copy, () => setCopy(null)];
}
// Notifications first (Android's own "Allow?" box), then the "Alarms & reminders" settings page if exact alarms are off.
export async function requestNotificationPermission() {
  const p = await Notifications.requestPermissionsAsync().catch(() => null);
  if (p?.granted && !(await exactAllowed())) await Notifications.requestExactAlarmPermissionsAsync().catch(() => {});
  return p;
}

// Tapping a notification or one of its buttons. onAction(id, data) handles buttons that change ride state.
export function useNotificationTaps(onAction) {
  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!last) return;
    const { actionIdentifier: id } = last;
    const data = last.notification.request.content.data ?? {};
    if (id === "call" && data.phone) return void Linking.openURL(`tel:${data.phone}`).catch(() => {});
    if (id === "walk" && data.walkUrl) return void Linking.openURL(data.walkUrl).catch(() => {});
    if (onAction?.(id, data)) return;
    const go = { view: "/accepted", track: "/coming", start: "/drive", find: "/results" }[id] ?? data.url;
    if (go) router.push(go);
  }, [last, onAction]);
}
