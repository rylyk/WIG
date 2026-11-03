import { useMemo, type HTMLAttributes, type ReactNode, type RefObject } from "react";
import { dateKeyFromParts, daySlot, formatDayKey } from "../lib/time";
import type { CellProps } from "./GridFrame";

export type DayCellProps = CellProps & { badge?: ReactNode };

interface Props {
  /** Event dates (YYYY-MM-DD), sorted. */
  dates: string[];
  renderDay: (slot: number, dateKey: string) => DayCellProps;
  bodyProps?: HTMLAttributes<HTMLDivElement>;
  bodyRef?: RefObject<HTMLDivElement>;
}

const weekdayNames = (() => {
  const f = new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: "UTC" });
  // 2023-01-01 was a Sunday.
  return Array.from({ length: 7 }, (_, i) => f.format(Date.UTC(2023, 0, 1 + i)));
})();

/** Month-calendar layout of an event's dates. Only months containing event dates are shown. */
export function MonthGrid({ dates, renderDay, bodyProps, bodyRef }: Props) {
  const months = useMemo(() => {
    const included = new Set(dates);
    const seen = new Map<string, { y: number; m: number }>();
    for (const d of dates) {
      const [y, m] = d.split("-").map(Number);
      seen.set(`${y}-${m}`, { y, m: m - 1 });
    }
    return [...seen.values()].map(({ y, m }) => {
      const offset = new Date(Date.UTC(y, m, 1)).getUTCDay();
      const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      const weeks = Math.ceil((offset + daysInMonth) / 7);
      const cells = Array.from({ length: weeks * 7 }, (_, i) => {
        const d = i - offset + 1;
        if (d < 1 || d > daysInMonth) return null;
        const key = dateKeyFromParts(y, m, d);
        return { d, key, inEvent: included.has(key) };
      });
      return { id: `${y}-${m}`, label: formatDayKey(dateKeyFromParts(y, m, 1), { month: "long", year: "numeric" }), cells };
    });
  }, [dates]);

  return (
    <div {...bodyProps} ref={bodyRef} className={`month-list ${bodyProps?.className ?? ""}`}>
      {months.map((month) => (
        <section key={month.id} className="month" aria-label={month.label}>
          <h3 className="month-title">{month.label}</h3>
          <div className="month-weekdays" aria-hidden>
            {weekdayNames.map((n) => (
              <span key={n}>{n}</span>
            ))}
          </div>
          <div className="month-days" role="grid">
            {month.cells.map((c, i) => {
              if (!c) return <span key={`b${i}`} className="mday blank" />;
              if (!c.inEvent) {
                return (
                  <span key={c.key} className="mday off" aria-hidden>
                    <span className="mday-num">{c.d}</span>
                  </span>
                );
              }
              const { badge, className, ...rest } = renderDay(daySlot(c.key), c.key);
              return (
                <div key={c.key} role="gridcell" {...rest} className={`mday in ${className ?? ""}`}>
                  <span className="mday-num">{c.d}</span>
                  {badge != null && <span className="mday-badge">{badge}</span>}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
