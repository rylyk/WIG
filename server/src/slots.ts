import { DateTime, IANAZone } from "luxon";

export function isValidZone(zone: string): boolean {
  return IANAZone.isValidZone(zone);
}

/**
 * Expand an event definition into the list of slot start instants (epoch ms).
 * Each date is interpreted in the event's timezone. Wall-clock times that do
 * not exist (DST gaps) collapse onto the next valid instant and are de-duped.
 */
export function generateSlots(opts: {
  dates: string[];
  startMinute: number;
  endMinute: number;
  slotMinutes: number;
  timezone: string;
}): number[] {
  const out = new Set<number>();
  for (const iso of opts.dates) {
    const day = DateTime.fromISO(iso, { zone: opts.timezone }).startOf("day");
    if (!day.isValid) continue;
    for (let m = opts.startMinute; m + opts.slotMinutes <= opts.endMinute; m += opts.slotMinutes) {
      const t = day.set({ hour: Math.floor(m / 60), minute: m % 60 });
      if (t.isValid) out.add(t.toMillis());
    }
  }
  return [...out].sort((a, b) => a - b);
}
