// The whole app's look lives here. Change a value here and every screen follows.
import { useColorScheme } from "react-native";

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
  },
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const fontSize = { sm: 13, md: 16, lg: 20, xl: 28, xxl: 32 };

export const radius = { md: 10, lg: 16, pill: 999 };

// Returns the theme for the phone's current light/dark setting.
export function useTheme() {
  const scheme = useColorScheme();
  return { colors: colors[scheme === "dark" ? "dark" : "light"], spacing, fontSize, radius };
}
