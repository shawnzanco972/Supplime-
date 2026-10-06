import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function parseISODate(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function formatDateLabel(key: string) {
  return parseISODate(key).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function formatShortDate(key: string) {
  return parseISODate(key).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function daysBetween(fromKey: string, toKey: string) {
  const a = parseISODate(fromKey).getTime();
  const b = parseISODate(toKey).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function addDays(key: string, days: number) {
  const d = parseISODate(key);
  d.setDate(d.getDate() + days);
  return todayKey(d);
}

export function minutesNow() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function parseHHMM(value: string) {
  const [h, m] = value.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function formatHHMM(minutes: number) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

export function formatClock(value: string) {
  const [hRaw, m] = value.split(":").map(Number);
  const h = hRaw ?? 0;
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${pad2(m ?? 0)} ${suffix}`;
}

export function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Winding down";
}
