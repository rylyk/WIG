import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import type { GridModel, Status } from "../lib/grid";
import { formatDayKey, formatMinutes } from "../lib/time";
import { GridFrame } from "./GridFrame";

interface Props {
  model: GridModel;
  slotMinutes: number;
  value: Map<number, Status>;
  onChange: (next: Map<number, Status>) => void;
  paint: Status;
  toolbar?: ReactNode;
}

interface Drag {
  pointerId: number;
  anchor: { day: number; row: number };
  end: { day: number; row: number };
  adding: boolean;
}

function cellFromPoint(x: number, y: number) {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-day]");
  if (!el) return null;
  return { day: Number(el.dataset.day), row: Number(el.dataset.row) };
}

export function AvailabilityGrid({ model, slotMinutes, value, onChange, paint, toolbar }: Props) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const [focus, setFocus] = useState<{ day: number; row: number }>({ day: 0, row: 0 });
  const bodyRef = useRef<HTMLDivElement>(null);
  const focusFromKeyboard = useRef(false);

  const inRect = (d: Drag, day: number, row: number) =>
    day >= Math.min(d.anchor.day, d.end.day) &&
    day <= Math.max(d.anchor.day, d.end.day) &&
    row >= Math.min(d.anchor.row, d.end.row) &&
    row <= Math.max(d.anchor.row, d.end.row);

  const commit = (d: Drag) => {
    const next = new Map(value);
    for (let day = Math.min(d.anchor.day, d.end.day); day <= Math.max(d.anchor.day, d.end.day); day++) {
      for (let row = Math.min(d.anchor.row, d.end.row); row <= Math.max(d.anchor.row, d.end.row); row++) {
        const slot = model.slotAt(day, row);
        if (slot === undefined) continue;
        if (d.adding) next.set(slot, paint);
        else next.delete(slot);
      }
    }
    onChange(next);
  };

  const toggle = (day: number, row: number) => {
    const slot = model.slotAt(day, row);
    if (slot === undefined) return;
    const next = new Map(value);
    if (next.get(slot) === paint) next.delete(slot);
    else next.set(slot, paint);
    onChange(next);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const cell = cellFromPoint(e.clientX, e.clientY);
    if (!cell) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const slot = model.slotAt(cell.day, cell.row);
    const adding = slot === undefined ? true : value.get(slot) !== paint;
    setFocus(cell);
    setDrag({ pointerId: e.pointerId, anchor: cell, end: cell, adding });
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const cell = cellFromPoint(e.clientX, e.clientY);
    if (cell && (cell.day !== drag.end.day || cell.row !== drag.end.row)) {
      setDrag({ ...drag, end: cell });
    }
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    commit(drag);
    setDrag(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    };
    if (e.key in moves) {
      e.preventDefault();
      const [dd, dr] = moves[e.key];
      focusFromKeyboard.current = true;
      setFocus((f) => ({
        day: Math.max(0, Math.min(model.days.length - 1, f.day + dd)),
        row: Math.max(0, Math.min(model.rows.length - 1, f.row + dr)),
      }));
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      toggle(focus.day, focus.row);
    }
  };

  useEffect(() => {
    if (!focusFromKeyboard.current) return;
    focusFromKeyboard.current = false;
    // Wait a frame so the pager can reveal the column first.
    requestAnimationFrame(() => {
      bodyRef.current
        ?.querySelector<HTMLElement>(`[data-day="${focus.day}"][data-row="${focus.row}"]`)
        ?.focus();
    });
  }, [focus]);

  const toggleDay = (day: number) => {
    const slots = model.rows
      .map((_, row) => model.slotAt(day, row))
      .filter((s): s is number => s !== undefined);
    const allPainted = slots.every((s) => value.get(s) === paint);
    const next = new Map(value);
    for (const s of slots) {
      if (allPainted) next.delete(s);
      else next.set(s, paint);
    }
    onChange(next);
  };

  return (
    <GridFrame
      model={model}
      slotMinutes={slotMinutes}
      toolbar={toolbar}
      revealDay={focus.day}
      onDayClick={toggleDay}
      dayClickLabel="Toggle the whole day"
      bodyProps={{
        className: `editable${drag ? " dragging" : ""}`,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel: () => setDrag(null),
        onKeyDown,
      }}
      bodyRef={bodyRef}
      renderCell={(slot, day, row) => {
        let status: Status | 0 = slot === undefined ? 0 : value.get(slot) ?? 0;
        if (drag && slot !== undefined && inRect(drag, day, row)) status = drag.adding ? paint : 0;
        const focused = focus.day === day && focus.row === row;
        const label = `${formatDayKey(model.days[day], { weekday: "long", month: "long", day: "numeric" })}, ${formatMinutes(model.rows[row])}`;
        return {
          "data-day": day,
          "data-row": row,
          tabIndex: focused ? 0 : -1,
          "aria-label": slot === undefined ? undefined : label,
          "aria-selected": status !== 0,
          className: status === 2 ? "on" : status === 1 ? "maybe" : "",
        };
      }}
    />
  );
}
