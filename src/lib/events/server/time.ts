import { err } from "@/lib/tailor/server/errors";

/**
 * Local wall-clock time + IANA zone -> UTC instant.
 *
 * Event organiser forms use `datetime-local` values, which carry no offset.
 * Guessing an offset silently moves an event by an hour across a DST change,
 * so the conversion is verified by formatting the result back. A time that does
 * not exist (spring-forward gap) and a time that occurs twice (fall-back) are
 * both rejected rather than resolved arbitrarily.
 */

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

interface Wall {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export function isSupportedTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function parseWallClock(value: string): Wall | null {
  const m = LOCAL_RE.exec(value.trim());
  if (!m) return null;
  const wall = {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: Number(m[4]),
    minute: Number(m[5]),
  };
  if (
    wall.month < 1 ||
    wall.month > 12 ||
    wall.day < 1 ||
    wall.day > 31 ||
    wall.hour > 23 ||
    wall.minute > 59
  )
    return null;
  return wall;
}

/** Milliseconds that the zone is ahead of UTC at the given instant. */
function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUtc - utcMs;
}

function formatWall(utcMs: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${String(Number(get("hour")) % 24).padStart(2, "0")}:${get("minute")}`;
}

function wallKey(wall: Wall): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${wall.year}-${p(wall.month)}-${p(wall.day)}T${p(wall.hour)}:${p(wall.minute)}`;
}

export function wallClockToUtcMs(value: string, timeZone: string): number {
  const wall = parseWallClock(value);
  if (!wall) throw err("INVALID_INPUT", "Enter a date and time as YYYY-MM-DDTHH:mm.");
  if (!isSupportedTimeZone(timeZone))
    throw err("INVALID_INPUT", "That timezone is not recognised. Use a name like Africa/Accra.");
  const guess = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, 0);
  const candidates = new Set<number>();
  for (const probe of [guess - 86_400_000, guess, guess + 86_400_000]) {
    const utc = guess - zoneOffsetMs(probe, timeZone);
    if (formatWall(utc, timeZone) === wallKey(wall)) candidates.add(utc);
  }
  if (candidates.size === 0) {
    // The clock skipped this minute. Retry from the exact instant as well:
    // some zones resolve deterministically even when the probe misses.
    const utc = guess - zoneOffsetMs(guess, timeZone);
    throw err(
      "INVALID_INPUT",
      `That local time does not exist in ${timeZone} because the clock changes then. Choose another time.`,
    );
  }
  if (candidates.size > 1) {
    throw err(
      "INVALID_INPUT",
      `That local time happens twice in ${timeZone} because the clock changes. Choose a time outside the repeated hour.`,
    );
  }
  return [...candidates][0]!;
}

/** Formats a UTC instant back into a `datetime-local` value for form editing. */
export function utcMsToWallClock(utcMs: number, timeZone: string): string {
  return formatWall(utcMs, timeZone);
}
