/** Business calendar helpers using IANA time zone (e.g. Asia/Shanghai). */

export function businessDay(timeZone: string, at = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

export function businessHourMinute(timeZone: string, at = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

/** true if current HH:mm in tz is >= dailyAt (HH:mm). */
export function isPastDailyAt(
  timeZone: string,
  dailyAt: string,
  at = new Date(),
): boolean {
  return businessHourMinute(timeZone, at) >= dailyAt;
}

export function addMinutesIso(at: Date, minutes: number): string {
  return new Date(at.getTime() + minutes * 60_000).toISOString();
}

export function dayPlusDays(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}
