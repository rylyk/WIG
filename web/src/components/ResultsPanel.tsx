import { CalendarCheck, Check, Minus, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { api, type EventData } from "../api";
import { bestBlocks, tallySlots, type Block, type GridModel } from "../lib/grid";
import { formatRange } from "../lib/time";
import { GridFrame } from "./GridFrame";
import { useToast } from "./Toast";
import { TimezoneSelect } from "./TimezoneSelect";

interface Props {
  event: EventData;
  model: GridModel;
  tz: string;
  onTzChange: (tz: string) => void;
  adminKey: string | null;
  myResponseId?: string;
  onChanged: () => Promise<unknown>;
  onRespond: () => void;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function ResultsPanel({ event, model, tz, onTzChange, adminKey, myResponseId, onChanged, onRespond }: Props) {
  const toast = useToast();
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);
  const [pinnedSlot, setPinnedSlot] = useState<number | null>(null);
  const [hoverPerson, setHoverPerson] = useState<string | null>(null);
  const [focusBlock, setFocusBlock] = useState<Block | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const step = event.slotMinutes * 60_000;
  const included = useMemo(
    () => event.responses.filter((r) => !excluded.has(r.id)),
    [event.responses, excluded],
  );
  const tally = useMemo(() => tallySlots(event.slots, included), [event.slots, included]);
  const best = useMemo(() => bestBlocks(event, tally), [event, tally]);
  const total = included.length;

  const activeSlot = hoverSlot ?? pinnedSlot;
  const activeTally = activeSlot != null ? tally.get(activeSlot) : undefined;

  const highlight = useMemo(() => {
    if (hoverPerson) {
      const r = event.responses.find((p) => p.id === hoverPerson);
      if (!r) return null;
      return new Set([...r.available, ...r.maybe]);
    }
    if (focusBlock) return new Set(focusBlock.slots);
    return null;
  }, [hoverPerson, focusBlock, event.responses]);

  const slotAtPointer = (e: { clientX: number; clientY: number }) => {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-slot]");
    return el ? Number(el.dataset.slot) : null;
  };

  const setFinal = async (start: number, end: number) => {
    if (!adminKey) return;
    try {
      await api.updateEvent(event.id, adminKey, { final: { start, end } });
      await onChanged();
      toast("Final time set");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  if (event.responses.length === 0) {
    return (
      <div className="empty-state card">
        <h2>No responses yet</h2>
        <p className="muted">Share the event link — results will appear here as people respond.</p>
        <button type="button" className="btn btn-primary" onClick={onRespond}>
          Add your availability
        </button>
      </div>
    );
  }

  const statusOf = (personId: string) => {
    if (!activeTally) return null;
    if (activeTally.available.includes(personId)) return "yes";
    if (activeTally.maybe.includes(personId)) return "maybe";
    return "no";
  };

  return (
    <div className="results">
      {best.length > 0 && total > 0 && (
        <section className="best">
          <h2 className="section-title">
            <Sparkles size={15} /> Best times
          </h2>
          <div className="best-list">
            {best.map((b, i) => {
              const { day, time } = formatRange(b.start, b.end, tz);
              const isFocused = focusBlock?.start === b.start && focusBlock?.end === b.end;
              return (
                <div
                  key={b.start}
                  className={`best-card${isFocused ? " focused" : ""}${i === 0 ? " top" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setFocusBlock(isFocused ? null : b)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setFocusBlock(isFocused ? null : b);
                    }
                  }}
                >
                  <div className="best-when">
                    <span className="best-day">{day}</span>
                    <span className="best-time">{time}</span>
                  </div>
                  <div className="best-who">
                    <span className="best-count">
                      <strong>{b.available.length}</strong>/{total} available
                      {b.maybe.length > 0 && <span className="muted"> · {b.maybe.length} if needed</span>}
                    </span>
                  </div>
                  {adminKey && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        void setFinal(b.start, b.end);
                      }}
                    >
                      <CalendarCheck size={14} /> Choose
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="results-layout">
        <div className="results-grid">
          <GridFrame
            model={model}
            slotMinutes={event.slotMinutes}
            toolbar={<TimezoneSelect value={tz} onChange={onTzChange} />}
            bodyProps={{
              className: "heat",
              onPointerMove: (e) => {
                if (e.pointerType === "mouse") setHoverSlot(slotAtPointer(e));
              },
              onPointerLeave: () => setHoverSlot(null),
              onClick: (e) => {
                const s = slotAtPointer(e);
                setPinnedSlot((p) => (p === s ? null : s));
              },
            }}
            renderCell={(slot) => {
              if (slot === undefined) return {};
              const t = tally.get(slot)!;
              const classes = ["heat-cell"];
              if (t.score > 0) classes.push("filled");
              if (total > 0 && t.available.length === total) classes.push("all");
              if (highlight && !highlight.has(slot)) classes.push("dim");
              if (slot === activeSlot) classes.push("active");
              if (event.final && slot >= event.final.start && slot < event.final.end) classes.push("final");
              return {
                "data-slot": slot,
                className: classes.join(" "),
                style: { ["--p" as string]: t.score.toFixed(3) },
                "aria-label": `${t.available.length} of ${total} available`,
              };
            }}
          />
          <div className="legend" aria-hidden>
            <span>0/{total}</span>
            <span className="legend-bar" />
            <span>{total}/{total} available</span>
          </div>
        </div>

        <aside className="results-side card">
          <div className="slot-detail">
            {activeSlot != null && activeTally ? (
              <>
                <div className="slot-detail-when">
                  {(() => {
                    const { day, time } = formatRange(activeSlot, activeSlot + step, tz);
                    return (
                      <>
                        <span className="best-day">{day}</span>
                        <span className="best-time">{time}</span>
                      </>
                    );
                  })()}
                </div>
                <div className="slot-detail-count">
                  <strong>{activeTally.available.length}</strong>/{total} available
                  {activeTally.maybe.length > 0 && <span className="muted"> · {activeTally.maybe.length} if needed</span>}
                </div>
                {adminKey && pinnedSlot != null && activeSlot === pinnedSlot && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => void setFinal(pinnedSlot, pinnedSlot + step)}
                  >
                    <CalendarCheck size={14} /> Choose this time
                  </button>
                )}
              </>
            ) : (
              <p className="muted small">Hover over or tap a time to see who's free. Hover a name to see their availability.</p>
            )}
          </div>

          <ul className="people">
            {event.responses.map((r) => {
              const status = excluded.has(r.id) ? null : statusOf(r.id);
              const isExcluded = excluded.has(r.id);
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    className={`person${isExcluded ? " excluded" : ""}${status ? ` s-${status}` : ""}`}
                    onMouseEnter={() => setHoverPerson(r.id)}
                    onMouseLeave={() => setHoverPerson(null)}
                    onFocus={() => setHoverPerson(r.id)}
                    onBlur={() => setHoverPerson(null)}
                    onClick={() =>
                      setExcluded((prev) => {
                        const next = new Set(prev);
                        if (next.has(r.id)) next.delete(r.id);
                        else next.add(r.id);
                        return next;
                      })
                    }
                    title={isExcluded ? "Include in results" : "Exclude from results"}
                  >
                    <span className="avatar">{initials(r.name)}</span>
                    <span className="person-name">
                      {r.name}
                      {r.id === myResponseId && <span className="muted"> (you)</span>}
                    </span>
                    <span className="person-status" aria-hidden>
                      {status === "yes" && <Check size={15} />}
                      {status === "maybe" && <span className="maybe-mark">?</span>}
                      {status === "no" && <Minus size={15} />}
                      {isExcluded && <X size={14} />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {excluded.size > 0 && (
            <button type="button" className="link-btn small" onClick={() => setExcluded(new Set())}>
              Include everyone again
            </button>
          )}
          <p className="muted small side-note">Click a name to leave them out of the results.</p>
        </aside>
      </div>

      {pinnedSlot != null && tally.get(pinnedSlot) && (
        <div className="slot-sheet" role="dialog" aria-label="Selected time">
          {(() => {
            const t = tally.get(pinnedSlot)!;
            const { day, time } = formatRange(pinnedSlot, pinnedSlot + step, tz);
            const names = (ids: string[]) =>
              ids.map((id) => event.responses.find((r) => r.id === id)?.name).filter(Boolean).join(", ");
            return (
              <>
                <div className="slot-sheet-head">
                  <div>
                    <span className="best-day">{day}</span>
                    <span className="best-time">{time}</span>
                  </div>
                  <button type="button" className="icon-btn" aria-label="Close" onClick={() => setPinnedSlot(null)}>
                    <X size={16} />
                  </button>
                </div>
                <p className="slot-sheet-line">
                  <span className="dot avail" /> <strong>{t.available.length}/{total}</strong>{" "}
                  {t.available.length > 0 ? names(t.available) : "No one available"}
                </p>
                {t.maybe.length > 0 && (
                  <p className="slot-sheet-line">
                    <span className="dot maybe" /> <strong>{t.maybe.length}</strong> if needed: {names(t.maybe)}
                  </p>
                )}
                {adminKey && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => void setFinal(pinnedSlot, pinnedSlot + step)}>
                    <CalendarCheck size={14} /> Choose this time
                  </button>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
