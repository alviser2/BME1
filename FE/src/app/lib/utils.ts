import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Convert drops/min to ml/sec (Assuming 20 drops = 1 ml)
export function dropsToMlPerSec(dropsPerMin: number) {
  return dropsPerMin / 20 / 60;
}

export function dropsToMlPerMin(dropsPerMin: number) {
  return dropsPerMin / 20;
}

export function calculateTimeRemainingInMinutes(volume: number, flowRateDropsPerMin: number) {
  if (flowRateDropsPerMin <= 0) return 0;
  const mlPerMin = dropsToMlPerMin(flowRateDropsPerMin);
  return volume / mlPerMin;
}

export function formatTimeRemaining(minutes: number) {
  if (minutes <= 0) return "Hết";
  if (!isFinite(minutes)) return "--";
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
