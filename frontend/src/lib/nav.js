import { router } from "expo-router";

// Back arrow: go back if there's a screen to return to, otherwise Home (e.g. when a screen was opened from a link).
export const goBack = () => (router.canGoBack() ? router.back() : router.replace("/home"));
