import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
} from "react";
import type { GridModel } from "../lib/grid";
import { formatDayKey, formatMinutes } from "../lib/time";

const LABEL_WIDTH = 56;
const MIN_COLUMN = 60;

export type CellProps = HTMLAttributes<HTMLDivElement> & { [key: `data-${string}`]: unknown };

interface Props {
  model: GridModel;
  slotMinutes: number;
  renderCell: (slot: number | undefined, day: number, row: number) => CellProps;
  onDayClick?: (day: number) => void;
  dayClickLabel?: string;
  /** Scroll the pager so this day index is visible. */
  revealDay?: number | null;
  bodyProps?: HTMLAttributes<HTMLDivElement>;
  bodyRef?: RefObject<HTMLDivElement>;
  toolbar?: ReactNode;
}

const rowHeight = (slotMinutes: number) => (slotMinutes === 15 ? 14 : slotMinutes === 30 ? 20 : 30);

export function GridFrame({
  model,
  slotMinutes,
  renderCell,
  onDayClick,
  dayClickLabel,
  revealDay,
  bodyProps,
  bodyRef,
  toolbar,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [perPage, setPerPage] = useState(7);
  const [start, setStart] = useState(0);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const fit = Math.floor((el.clientWidth - LABEL_WIDTH) / MIN_COLUMN);
      setPerPage(Math.max(1, Math.min(fit, 14)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const count = model.days.length;
  const size = Math.min(perPage, count);
  const maxStart = Math.max(0, count - size);
  const from = Math.min(start, maxStart);
  const visible = model.days.slice(from, from + size).map((d, i) => ({ key: d, index: from + i }));

  useEffect(() => {
    if (revealDay == null) return;
    if (revealDay < from) setStart(revealDay);
    else if (revealDay >= from + size) setStart(revealDay - size + 1);
  }, [revealDay, from, size]);

  const paged = count > size;
  const first = visible[0]?.key;
  const last = visible[visible.length - 1]?.key;
  const rangeLabel =
    first && last
      ? first === last
        ? formatDayKey(first, { month: "long", day: "numeric", year: "numeric" })
        : `${formatDayKey(first, { month: "short", day: "numeric" })} – ${formatDayKey(last, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}`
      : "";

  const labelFor = (i: number) => {
    const m = model.rows[i];
    if (i === 0 || model.breaks[i] || m % 60 === 0) return formatMinutes(m, true);
    return null;
  };
  const endLabel =
    model.rows.length > 0 ? formatMinutes(model.rows[model.rows.length - 1] + slotMinutes, true) : "";

  return (
    <div className="grid-frame" ref={wrapRef} style={{ ["--row-h" as string]: `${rowHeight(slotMinutes)}px` }}>
      <div className="grid-toolbar">
        <div className="grid-range">{rangeLabel}</div>
        <div className="grid-toolbar-right">
          {toolbar}
          {paged && (
            <div className="pager">
              <button
                type="button"
                className="icon-btn"
                aria-label="Previous days"
                disabled={from === 0}
                onClick={() => setStart(Math.max(0, from - size))}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label="Next days"
                disabled={from >= maxStart}
                onClick={() => setStart(Math.min(maxStart, from + size))}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid-head" style={{ paddingLeft: LABEL_WIDTH }}>
        {visible.map(({ key, index }) => {
          const content = (
            <>
              <span className="grid-head-wd">{formatDayKey(key, { weekday: "short" })}</span>
              <span className="grid-head-d">{formatDayKey(key, { month: "short", day: "numeric" })}</span>
            </>
          );
          return onDayClick ? (
            <button
              key={key}
              type="button"
              className="grid-head-cell clickable"
              title={dayClickLabel}
              onClick={() => onDayClick(index)}
            >
              {content}
            </button>
          ) : (
            <div key={key} className="grid-head-cell">
              {content}
            </div>
          );
        })}
      </div>

      <div
        role="grid"
        {...bodyProps}
        ref={bodyRef}
        className={`grid-body ${bodyProps?.className ?? ""}`}
      >
        <div className="grid-labels" style={{ width: LABEL_WIDTH }} aria-hidden>
          {model.rows.map((m, i) => (
            <div key={m} className={`grid-label${model.breaks[i] ? " break" : ""}`}>
              {labelFor(i) && <span>{labelFor(i)}</span>}
            </div>
          ))}
          <div className="grid-label end">
            <span>{endLabel}</span>
          </div>
        </div>
        {visible.map(({ key, index }) => (
          <div key={key} className="grid-col" role="row">
            {model.rows.map((m, row) => {
              const slot = model.slotAt(index, row);
              const props = renderCell(slot, index, row);
              const lineClass = row === 0 || model.breaks[row] ? "" : m % 60 === 0 ? " hour" : " sub";
              return (
                <div
                  key={m}
                  role="gridcell"
                  {...props}
                  className={`cell${lineClass}${model.breaks[row] ? " break" : ""}${
                    slot === undefined ? " missing" : ""
                  } ${props.className ?? ""}`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
