// Asks a host for a seat, after the one-trip-at-a-time checks. Used by Ride results and See on map.
// You stay on the screen: the ride card shows “Request sent” with Cancel until the host answers.
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import { maybeAskForNotifications } from "./notify";
import { bookRide, confirmWithdraw, getTrips, hostById, useTrips } from "./trips";

export function requestSeat(hostId, drop, pickup) {
  const { booking, published } = getTrips();
  if (booking?.status === "requested" && booking.host.id === hostId) return;
  if (published) return Alert.alert("You’re hosting a ride", "Finish or cancel your published ride before booking a seat.");
  const first = booking?.host.name.split(" ")[0];
  if (booking?.status === "requested") {
    return Alert.alert(`You’ve already asked ${first}`, "You can have one seat request at a time. Withdraw it to ask someone else.", [
      { text: "Close", style: "cancel" },
      { text: "Withdraw", style: "destructive", onPress: () => confirmWithdraw() },
    ]);
  }
  if (booking?.status === "accepted") {
    return Alert.alert(`You’re riding with ${first}`, "Cancel that ride first if you want to book a different one.", [
      { text: "Close", style: "cancel" },
      { text: "View ride", onPress: () => router.push("/accepted") },
    ]);
  }
  bookRide(hostId, drop, pickup);
  const host = hostById(hostId);
  const name = host.name.split(" ")[0];
  maybeAskForNotifications({ title: `Know the moment ${name} accepts`, text: "And a reminder when it’s time to leave.", preview: [`${name} accepted your request`, `Tomorrow ${host.time} AM · ${host.vehicle}`] });
}

// Opens the accepted ride as soon as the host accepts your request while you are on this screen.
export function useOpenRideWhenAccepted() {
  const status = useTrips().booking?.status;
  const before = useRef(status);
  useEffect(() => {
    if (before.current === "requested" && status === "accepted") router.push("/accepted");
    before.current = status;
  }, [status]);
}

// "8:35" -> "08:35 – 08:45 AM", "11:55" -> "11:55 AM – 12:05 PM": the 10-minute pickup window shown on ride cards.
export function pickupWindow(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const clock = (t) => `${String(Math.floor(t / 60) % 12 || 12).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  const half = (t) => (Math.floor(t / 60) % 24 < 12 ? "AM" : "PM");
  const start = h * 60 + m;
  const end = start + 10;
  return half(start) === half(end) ? `${clock(start)} – ${clock(end)} ${half(end)}` : `${clock(start)} ${half(start)} – ${clock(end)} ${half(end)}`;
}
export const ampm = (hhmm) => (Number(hhmm.split(":")[0]) < 12 ? "AM" : "PM");
