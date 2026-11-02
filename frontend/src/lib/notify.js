// Notifications: reminders scheduled on this phone (work offline) and ride alerts with buttons.
// shortcut: ride alerts are sent from the phone for the example data; once the backend sends push (PUT /v1/me/devices),
// they arrive from the server with the same channels, buttons and data.
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { AppState, Linking, Platform } from "react-native";

// Android categories: each one can be muted on its own in Settings → Apps → Cpool → Notifications.
const CHANNELS = {
  ride: ["Ride updates", "Accepted, declined, cancelled"],
  requests: ["Seat requests", "For hosts · Accept / Decline"],
  reminders: ["Reminders", "15 min before every ride"],
};
const BUTTONS = {
  "ride-accepted": [["view", "View ride"], ["call", "Call"]],
  "seat-request": [["accept", "Accept"], ["decline", "Decline"]],
  "pickup-reminder": [["walk", "Walk directions"], ["track", "Track ride"]],
  "leave-reminder": [["start", "Start ride"]],
  find: [["find", "Find a ride"]],
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
// One per key; scheduling the same key again replaces it.
const scheduled = {};
async function schedule(key, content, trigger) {
  await cancelScheduled(key);
  try {
    scheduled[key] = await Notifications.scheduleNotificationAsync({ content, trigger });
  } catch {}
}
export async function cancelScheduled(key) {
  const id = scheduled[key];
  delete scheduled[key];
  if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}
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

// Asks for permission once per app start, at the moment it makes sense (first request or publish). copy: { title, text, preview }
let asked = false;
const askers = new Set();
export async function maybeAskForNotifications(copy) {
  if (asked) return;
  asked = true;
  const p = await Notifications.getPermissionsAsync().catch(() => null);
  if (!p || p.granted || !p.canAskAgain) return;
  askers.forEach((fn) => fn(copy));
}
export function useNotificationAsk() {
  const [copy, setCopy] = useState(null);
  useEffect(() => {
    askers.add(setCopy);
    return () => askers.delete(setCopy);
  }, []);
  return [copy, () => setCopy(null)];
}
export const requestNotificationPermission = () => Notifications.requestPermissionsAsync().catch(() => null);

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
