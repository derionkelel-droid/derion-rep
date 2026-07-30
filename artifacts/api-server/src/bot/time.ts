import { logger } from "../lib/logger";

// Force Moscow timezone (UTC+3, no DST)
export const MSK_TIMEZONE = "Europe/Moscow";

/**
 * Returns a Date object representing the current MSK time.
 * Node.js Date with TZ=Europe/Moscow already handles this,
 * but we also provide a fallback via direct offset calculation.
 */
export function getMskDate(): Date {
  const now = new Date();
  // If TZ env is set correctly, Date already returns local MSK time
  // Fallback: manually compute MSK offset
  const mskOffset = 3 * 60; // UTC+3 in minutes
  const localOffset = now.getTimezoneOffset(); // minutes from UTC
  const diff = mskOffset + localOffset; // minutes to add
  return new Date(now.getTime() + diff * 60 * 1000);
}

/**
 * Get current MSK time components for comparison/logic.
 */
export function getMskTime() {
  const msk = getMskDate();
  return {
    hours: msk.getUTCHours(),
    minutes: msk.getUTCMinutes(),
    seconds: msk.getUTCSeconds(),
    dayOfWeek: msk.getUTCDay(),       // 0=Sun, 6=Sat
    dayOfMonth: msk.getUTCDate(),
    month: msk.getUTCMonth() + 1,
    year: msk.getUTCFullYear(),
    unix: Math.floor(msk.getTime() / 1000),
  };
}

/**
 * Format current MSK time as HH:MM:SS string.
 */
export function formatMskTime(): string {
  const t = getMskTime();
  return `${String(t.hours).padStart(2, "0")}:${String(t.minutes).padStart(2, "0")}:${String(t.seconds).padStart(2, "0")}`;
}

/**
 * Get the start of today in MSK unix seconds.
 */
export function getMskDayStart(): number {
  const t = getMskTime();
  // Compute start of today MSK in unix seconds
  const date = new Date(Date.UTC(t.year, t.month - 1, t.dayOfMonth, 0, 0, 0, 0));
  // This date is already in MSK-relative terms since getMskTime() returns MSK values.
  // Convert back: since we used UTC constructor with MSK values, the resulting timestamp
  // is actually MSK day start expressed as a UTC timestamp (which is the correct unix time).
  return Math.floor(date.getTime() / 1000);
}

/**
 * Check if current MSK time is within a range (inclusive).
 */
export function isMskTimeBetween(startHour: number, endHour: number): boolean {
  const t = getMskTime();
  if (startHour <= endHour) {
    return t.hours >= startHour && t.hours <= endHour;
  }
  // Wraps around midnight (e.g. 22:00 - 04:00)
  return t.hours >= startHour || t.hours <= endHour;
}
