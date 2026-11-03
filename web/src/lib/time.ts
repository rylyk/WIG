const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(key: string, make: () => Intl.DateTimeFormat) {
  let f = formatters.get(key);
  if (!f) {
    f = make();
    formatters.set(key, f);
  }
  return f;
}

export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function allTimeZones(): string[] {
  try {
    const zones = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
      .supportedValuesOf?.("timeZone");
    if (zones?.length) return zones.includes("UTC") ? zones : ["UTC", ...zones];
  } catch {
    /* fall through */
  }
  return ["UTC", localTimeZone()];
}

/** Wall-clock date key (YYYY-MM-DD) and minute-of-day for an instant in a zone. */
export function zonedParts(ms: number, tz: string): { dateKey: string; minutes: number } {
  const f = formatter(`parts:${tz}`, () =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }),
  );
  const p: Record<string, string> = {};
  for (const part of f.formatToParts(ms)) p[part.type] = part.value;
  const hour = Number(p.hour) % 24;
  return {
    dateKey: `${p.year}-${p.month}-${p.day}`,
    minutes: hour * 60 + Number(p.minute),
  };
}

/** Offset label such as "GMT-5" or "GMT+5:30" for a zone at a given instant. */
export function offsetLabel(tz: string, at = Date.now()): string {
  try {
    const f = formatter(`offset:${tz}`, () =>
      new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }),
    );
    const name = f.formatToParts(at).find((p) => p.type === "timeZoneName")?.value;
    return name ?? "";
  } catch {
    return "";
  }
}

export function prettyZone(tz: string): string {
  return tz.replace(/_/g, " ").replace(/\//g, " / ");
}

function utcFromKey(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function dateKeyFromParts(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function todayKey(): string {
  const now = new Date();
  return dateKeyFromParts(now.getFullYear(), now.getMonth(), now.getDate());
}

export function formatDayKey(dateKey: string, opts: Intl.DateTimeFormatOptions): string {
  const f = formatter(`day:${JSON.stringify(opts)}`, () =>
    new Intl.DateTimeFormat(undefined, { ...opts, timeZone: "UTC" }),
  );
  return f.format(utcFromKey(dateKey));
}

/** Format a minute-of-day as a short clock label ("9 AM", "9:30 AM", "21:00"). */
export function formatMinutes(minutes: number, compact = false): string {
  const m = minutes % 1440;
  const showMinutes = !compact || m % 60 !== 0;
  const f = formatter(`min:${showMinutes}`, () =>
    new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: showMinutes ? "2-digit" : undefined,
      timeZone: "UTC",
    }),
  );
  return f.format(Date.UTC(2000, 0, 1, 0, m));
}

export function formatInstant(ms: number, tz: string, opts: Intl.DateTimeFormatOptions): string {
  const f = formatter(`inst:${tz}:${JSON.stringify(opts)}`, () =>
    new Intl.DateTimeFormat(undefined, { ...opts, timeZone: tz }),
  );
  return f.format(ms);
}

/** "Tue, Nov 10" + "2:00 – 3:30 PM" for a time range, in a zone. */
export function formatRange(start: number, end: number, tz: string) {
  const day = formatInstant(start, tz, { weekday: "short", month: "short", day: "numeric" });
  const timeOpts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  let time: string;
  try {
    const f = formatter(`range:${tz}`, () =>
      new Intl.DateTimeFormat(undefined, { ...timeOpts, timeZone: tz }),
    );
    time = (f as Intl.DateTimeFormat & {
      formatRange: (a: number, b: number) => string;
    }).formatRange(start, end);
  } catch {
    time = `${formatInstant(start, tz, timeOpts)} – ${formatInstant(end, tz, timeOpts)}`;
  }
  const sameDay = zonedParts(start, tz).dateKey === zonedParts(end - 1, tz).dateKey;
  if (!sameDay) {
    time = `${formatInstant(start, tz, timeOpts)} – ${formatInstant(end, tz, {
      ...timeOpts,
      weekday: "short",
    })}`;
  }
  return { day, time };
}

export function summarizeDates(dates: string[]): string {
  if (dates.length === 0) return "";
  const first = dates[0];
  const last = dates[dates.length - 1];
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (dates.length === 1) return formatDayKey(first, { weekday: "short", ...opts });
  return `${formatDayKey(first, opts)} – ${formatDayKey(last, opts)}`;
}
