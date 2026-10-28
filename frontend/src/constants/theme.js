// The whole app's look lives here. Change a value here and every screen follows.
import { useMemo } from "react";
import { Appearance, useColorScheme, useWindowDimensions } from "react-native";

export const colors = {
  light: {
    background: "#FFFFFF",
    surface: "#F4F6F8",
    text: "#111827",
    textMuted: "#6B7280",
    border: "#D1D5DB",
    primary: "#1D4ED8",
    onPrimary: "#FFFFFF",
    secondary: "#E5E7EB",
    onSecondary: "#111827",
    error: "#B91C1C",
    disabled: "#9CA3AF",
    success: "#047857",
    successSurface: "#ECFDF5",
    warning: "#92400E",
    warningSurface: "#FEF3C7",
    primarySurface: "#EFF6FF",
    // Photo cards (role screen) look the same in light and dark mode.
    guestShade: "#172554",
    guestTint: "#1E3A8A",
    hostShade: "#022C22",
    hostTint: "#064E3B",
    onImage: "#FFFFFF",
    onImageInk: "#0B0F14",
    scrim: "rgba(0,0,0,0.5)",
    // Home / rides screens (Uber-style): ink buttons, green for publish / accept
    ink: "#0A0A0A",
    onInk: "#FFFFFF",
    green: "#0F9D63",
    onGreen: "#FFFFFF",
    greenSurface: "#E6F6EE",
    line: "#ECEDEF",
    danger: "#DC2626",
    route: "#0A0A0A",
  },
  dark: {
    background: "#0B0F14",
    surface: "#161B22",
    text: "#F3F4F6",
    textMuted: "#9CA3AF",
    border: "#374151",
    primary: "#60A5FA",
    onPrimary: "#0B0F14",
    secondary: "#1F2937",
    onSecondary: "#F3F4F6",
    error: "#F87171",
    disabled: "#4B5563",
    success: "#34D399",
    successSurface: "#052E1F",
    warning: "#FBBF24",
    warningSurface: "#33290A",
    primarySurface: "#102243",
    guestShade: "#172554",
    guestTint: "#1E3A8A",
    hostShade: "#022C22",
    hostTint: "#064E3B",
    onImage: "#FFFFFF",
    onImageInk: "#0B0F14",
    scrim: "rgba(0,0,0,0.5)",
    ink: "#F5F5F7",
    onInk: "#0A0A0A",
    green: "#22C55E",
    onGreen: "#03261B",
    greenSurface: "#0B2A1E",
    line: "#2A2A2E",
    danger: "#EF4444",
    route: "#F5F5F7",
  },
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const fontSize = { sm: 13, md: 16, lg: 20, xl: 28, xxl: 32 };

export const radius = { md: 10, lg: 16, pill: 999 };

// Appearance chosen in Account: "system" follows the phone, "light" / "dark" override it for the whole app.
// shortcut: kept in memory, so it resets to "system" when the app restarts; save it with AsyncStorage if people ask.
let appearance = "system";
export const getAppearance = () => appearance;
export function setAppearance(mode) {
  appearance = mode;
  Appearance.setColorScheme(mode === "system" ? "unspecified" : mode);
}

// The app was designed on a 420 dp wide phone. Other screens scale from that, within limits.
const DESIGN_WIDTH = 420;
export const sizeScale = (width) => Math.min(1.15, Math.max(0.85, width / DESIGN_WIDTH));
// Text also follows the phone's font-size setting, but stops growing at 1.3× so layouts don't break.
export const textScale = (width, fontScale) => sizeScale(width) * Math.min(1, 1.3 / fontScale);
const scaled = (obj, k) => Object.fromEntries(Object.entries(obj).map(([key, v]) => [key, Math.round(v * k)]));

// Theme for the current light/dark setting and screen. rs(n) scales a size, rf(n) scales a font size;
// use them instead of plain numbers so every screen fits the phone it runs on.
export function useTheme() {
  const scheme = useColorScheme();
  const { width, fontScale } = useWindowDimensions();
  const k = sizeScale(width);
  const t = textScale(width, fontScale);
  return useMemo(
    () => ({
      colors: colors[scheme === "dark" ? "dark" : "light"],
      spacing: scaled(spacing, k),
      fontSize: scaled(fontSize, t),
      radius: { ...radius, md: Math.round(radius.md * k), lg: Math.round(radius.lg * k) },
      rs: (n) => Math.round(n * k),
      rf: (n) => Math.round(n * t),
    }),
    [scheme, k, t],
  );
}
