import type { EventData, ParticipantResponse } from "../api";
import { zonedParts } from "./time";

export interface GridModel {
  days: string[];
  rows: number[];
  /** Row index → true when there is a time gap before this row. */
  breaks: boolean[];
  slotAt: (day: number, row: number) => number | undefined;
  positionOf: Map<number, { day: number; row: number }>;
}

/** Lay out the event's slots as a day × time-of-day grid in the viewer's zone. */
export function buildGrid(slots: number[], slotMinutes: number, tz: string): GridModel {
  const daySet = new Set<string>();
  const rowSet = new Set<number>();
  const parts = slots.map((s) => {
    const p = zonedParts(s, tz);
    daySet.add(p.dateKey);
    rowSet.add(p.minutes);
    return p;
  });
  const days = [...daySet].sort();
  const rows = [...rowSet].sort((a, b) => a - b);
  const dayIdx = new Map(days.map((d, i) => [d, i]));
  const rowIdx = new Map(rows.map((r, i) => [r, i]));

  const lookup = new Map<string, number>();
  const positionOf = new Map<number, { day: number; row: number }>();
  parts.forEach((p, i) => {
    const day = dayIdx.get(p.dateKey)!;
    const row = rowIdx.get(p.minutes)!;
    lookup.set(`${day}:${row}`, slots[i]);
    positionOf.set(slots[i], { day, row });
  });

  return {
    days,
    rows,
    breaks: rows.map((r, i) => i > 0 && r - rows[i - 1] > slotMinutes),
    slotAt: (day, row) => lookup.get(`${day}:${row}`),
    positionOf,
  };
}

export type Status = 2 | 1; // 2 = available, 1 = if needed

export interface SlotTally {
  available: string[];
  maybe: string[];
  score: number; // 0..1, "if needed" counts as half
}

export function tallySlots(
  slots: number[],
  responses: ParticipantResponse[],
): Map<number, SlotTally> {
  const tally = new Map<number, SlotTally>();
  for (const s of slots) tally.set(s, { available: [], maybe: [], score: 0 });
  for (const r of responses) {
    for (const s of r.available) tally.get(s)?.available.push(r.id);
    for (const s of r.maybe) tally.get(s)?.maybe.push(r.id);
  }
  const n = responses.length;
  for (const t of tally.values()) {
    t.score = n === 0 ? 0 : (t.available.length + t.maybe.length * 0.5) / n;
  }
  return tally;
}

export interface Block {
  start: number;
  end: number;
  slots: number[];
  available: string[];
  maybe: string[];
}

/**
 * Merge consecutive slots that share the exact same set of attendees into
 * blocks and rank them: most available first, then most "if needed", then
 * longest, then earliest.
 */
export function bestBlocks(
  event: Pick<EventData, "slots" | "slotMinutes">,
  tally: Map<number, SlotTally>,
  limit = 3,
): Block[] {
  const step = event.slotMinutes * 60_000;
  const blocks: Block[] = [];
  let current: (Block & { key: string }) | null = null;

  for (const s of event.slots) {
    const t = tally.get(s);
    if (!t || t.available.length + t.maybe.length === 0) {
      current = null;
      continue;
    }
    const key = `${[...t.available].sort().join(",")}|${[...t.maybe].sort().join(",")}`;
    if (current && current.key === key && current.end === s) {
      current.end = s + step;
      current.slots.push(s);
    } else {
      current = { key, start: s, end: s + step, slots: [s], available: t.available, maybe: t.maybe };
      blocks.push(current);
    }
  }

  return blocks
    .sort(
      (a, b) =>
        b.available.length - a.available.length ||
        b.maybe.length - a.maybe.length ||
        b.end - b.start - (a.end - a.start) ||
        a.start - b.start,
    )
    .slice(0, limit)
    .map(({ start, end, slots, available, maybe }) => ({ start, end, slots, available, maybe }));
}
