import { useRef, type PointerEvent } from "react";
import type { Status } from "../lib/grid";
import { formatDayKey } from "../lib/time";
import { MonthGrid } from "./MonthGrid";

interface Props {
  dates: string[];
  value: Map<number, Status>;
  onChange: (next: Map<number, Status>) => void;
  paint: Status;
}

function slotFromPoint(x: number, y: number) {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-slot]");
  return el ? Number(el.dataset.slot) : null;
}

/** Whole-day availability: tap a day to toggle it, or drag across days to paint them. */
export function AvailabilityMonth({ dates, value, onChange, paint }: Props) {
  const drag = useRef<{ pointerId: number; adding: boolean; seen: Set<number>; next: Map<number, Status> } | null>(null);

  const apply = (slot: number) => {
    const s = drag.current;
    if (!s || s.seen.has(slot)) return;
    s.seen.add(slot);
    if (s.adding) s.next.set(slot, paint);
    else s.next.delete(slot);
    onChange(new Map(s.next));
  };

  const toggle = (slot: number) => {
    const next = new Map(value);
    if (next.get(slot) === paint) next.delete(slot);
    else next.set(slot, paint);
    onChange(next);
  };

  return (
    <MonthGrid
      dates={dates}
      bodyProps={{
        className: "editable",
        onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
          if (e.button !== 0) return;
          const slot = slotFromPoint(e.clientX, e.clientY);
          if (slot == null) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = {
            pointerId: e.pointerId,
            adding: value.get(slot) !== paint,
            seen: new Set(),
            next: new Map(value),
          };
          apply(slot);
        },
        onPointerMove: (e) => {
          if (drag.current?.pointerId !== e.pointerId) return;
          const slot = slotFromPoint(e.clientX, e.clientY);
          if (slot != null) apply(slot);
        },
        onPointerUp: () => {
          drag.current = null;
        },
        onPointerCancel: () => {
          drag.current = null;
        },
      }}
      renderDay={(slot, key) => {
        const status = value.get(slot) ?? 0;
        return {
          "data-slot": slot,
          tabIndex: 0,
          role: "button",
          "aria-pressed": status !== 0,
          "aria-label": `${formatDayKey(key, { weekday: "long", month: "long", day: "numeric" })}${
            status === 2 ? ", available" : status === 1 ? ", if needed" : ""
          }`,
          className: status === 2 ? "on" : status === 1 ? "maybe" : "",
          onKeyDown: (e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              toggle(slot);
            }
          },
        };
      }}
    />
  );
}
