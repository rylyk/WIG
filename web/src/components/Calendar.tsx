import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useRef, useState, type PointerEvent } from "react";
import { dateKeyFromParts, todayKey } from "../lib/time";

interface Props {
  value: Set<string>;
  onChange: (next: Set<string>) => void;
}

const weekdayNames = (() => {
  const f = new Intl.DateTimeFormat(undefined, { weekday: "narrow", timeZone: "UTC" });
  // 2023-01-01 was a Sunday.
  return Array.from({ length: 7 }, (_, i) => f.format(Date.UTC(2023, 0, 1 + i)));
})();

export function Calendar({ value, onChange }: Props) {
  const today = todayKey();
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth() };
  });
  const drag = useRef<{ adding: boolean; seen: Set<string>; next: Set<string> } | null>(null);

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1).getDay();
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
    return Array.from({ length: 42 }, (_, i) => {
      const d = i - first + 1;
      return d >= 1 && d <= daysInMonth ? { d, key: dateKeyFromParts(cursor.y, cursor.m, d) } : null;
    });
  }, [cursor]);

  const monthLabel = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(
    new Date(cursor.y, cursor.m, 1),
  );

  const nowMonth = new Date();
  const atCurrentMonth = cursor.y === nowMonth.getFullYear() && cursor.m === nowMonth.getMonth();

  const shift = (delta: number) =>
    setCursor(({ y, m }) => {
      const nm = m + delta;
      return { y: y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 };
    });

  const keyAt = (x: number, y: number) =>
    document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-date]")?.dataset.date;

  const apply = (key: string) => {
    const s = drag.current;
    if (!s || s.seen.has(key) || key < today) return;
    s.seen.add(key);
    if (s.adding) s.next.add(key);
    else s.next.delete(key);
    onChange(new Set(s.next));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const key = keyAt(e.clientX, e.clientY);
    if (!key || key < today) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { adding: !value.has(key), seen: new Set(), next: new Set(value) };
    apply(key);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const key = keyAt(e.clientX, e.clientY);
    if (key) apply(key);
  };

  const end = () => {
    drag.current = null;
  };

  return (
    <div className="calendar">
      <div className="calendar-head">
        <span className="calendar-month">{monthLabel}</span>
        <div className="pager">
          <button
            type="button"
            className="icon-btn"
            aria-label="Previous month"
            disabled={atCurrentMonth}
            onClick={() => shift(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <button type="button" className="icon-btn" aria-label="Next month" onClick={() => shift(1)}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="calendar-weekdays" aria-hidden>
        {weekdayNames.map((n, i) => (
          <span key={i}>{n}</span>
        ))}
      </div>
      <div
        className="calendar-grid"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
      >
        {cells.map((c, i) =>
          c ? (
            <button
              key={c.key}
              type="button"
              data-date={c.key}
              disabled={c.key < today}
              aria-pressed={value.has(c.key)}
              className={`calendar-day${value.has(c.key) ? " selected" : ""}${
                c.key === today ? " today" : ""
              }`}
              onClick={(e) => {
                // Pointer interactions are handled on pointerdown; this covers keyboard.
                if (e.detail !== 0) return;
                const next = new Set(value);
                if (next.has(c.key)) next.delete(c.key);
                else next.add(c.key);
                onChange(next);
              }}
            >
              {c.d}
            </button>
          ) : (
            <span key={`blank-${i}`} className="calendar-day blank" />
          ),
        )}
      </div>
    </div>
  );
}
