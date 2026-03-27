import { Dimensions } from "react-native";

// Android-friendly baseline width for most phones.
const BASE_WIDTH = 360;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

// Compute once from current window width for consistent scaling across devices.
const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_SCALE = clamp(SCREEN_WIDTH / BASE_WIDTH, 0.85, 1.15);

export function scale(size: number) {
  return Math.round(size * SCREEN_SCALE);
}

// For typography we typically want slightly more conservative scaling.
export function fontScale(size: number) {
  return Math.round(size * clamp(SCREEN_SCALE, 0.9, 1.1));
}

