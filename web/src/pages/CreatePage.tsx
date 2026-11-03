import { ArrowRight, CalendarDays, Clock, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Calendar } from "../components/Calendar";
import { TimezoneSelect } from "../components/TimezoneSelect";
import { storage } from "../lib/storage";
import { formatDayKey, formatMinutes, localTimeZone } from "../lib/time";

const TIME_OPTIONS = Array.from({ length: 49 }, (_, i) => i * 30);
const SLOT_OPTIONS = [15, 30, 60] as const;

export function CreatePage() {
  const navigate = useNavigate();
  const [kind, setKind] = useState<"times" | "days">("times");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dates, setDates] = useState<Set<string>>(new Set());
  const [startMinute, setStartMinute] = useState(9 * 60);
  const [endMinute, setEndMinute] = useState(17 * 60);
  const [slotMinutes, setSlotMinutes] = useState<15 | 30 | 60>(30);
  const [timezone, setTimezone] = useState(localTimeZone);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sortedDates = [...dates].sort();
  const canSubmit =
    title.trim().length > 0 && dates.size > 0 && (kind === "days" || endMinute > startMinute);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const base = { title: title.trim(), description: description.trim(), dates: sortedDates };
      const { id, adminKey } = await api.createEvent(
        kind === "days"
          ? { ...base, kind }
          : { ...base, kind, startMinute, endMinute, slotMinutes, timezone },
      );
      storage.setAdminKey(id, adminKey);
      storage.rememberEvent({ id, title: title.trim(), admin: true });
      navigate(`/e/${id}/created`, { state: { adminKey } });
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <div className="page create-page">
      <header className="hero">
        <h1>Find a time that works for everyone.</h1>
        <p className="muted">
          Pick some dates, share a link, and see when your group is free. No sign-up required.
        </p>
      </header>

      <form className="create-form card" onSubmit={onSubmit}>
        <section className="create-details">
          <div className="field">
            <label htmlFor="title">Event name</label>
            <input
              id="title"
              className="input input-lg"
              placeholder="Team planning session"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="description">
              Details <span className="muted">(optional)</span>
            </label>
            <textarea
              id="description"
              className="input"
              rows={3}
              placeholder="Agenda, location, or a note for participants"
              value={description}
              maxLength={2000}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="field">
            <span className="label">What are you scheduling?</span>
            <div className="segmented" role="radiogroup" aria-label="Event type">
              <button
                type="button"
                role="radio"
                aria-checked={kind === "times"}
                className={kind === "times" ? "active" : ""}
                onClick={() => setKind("times")}
              >
                <Clock size={15} /> Specific times
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={kind === "days"}
                className={kind === "days" ? "active" : ""}
                onClick={() => setKind("days")}
              >
                <CalendarDays size={15} /> Whole days
              </button>
            </div>
            {kind === "days" && (
              <p className="hint">People mark which days they're free on a month calendar.</p>
            )}
          </div>

          {kind === "times" && (
            <>
              <div className="field">
                <span className="label">Times of day</span>
                <div className="time-range">
                  <div className="select-wrap">
                    <Clock size={15} aria-hidden />
                    <select
                      aria-label="Earliest time"
                      value={startMinute}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setStartMinute(v);
                        if (endMinute <= v) setEndMinute(Math.min(1440, v + 60));
                      }}
                    >
                      {TIME_OPTIONS.slice(0, -1).map((m) => (
                        <option key={m} value={m}>
                          {formatMinutes(m)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="muted">to</span>
                  <div className="select-wrap">
                    <Clock size={15} aria-hidden />
                    <select
                      aria-label="Latest time"
                      value={endMinute}
                      onChange={(e) => setEndMinute(Number(e.target.value))}
                    >
                      {TIME_OPTIONS.filter((m) => m > startMinute).map((m) => (
                        <option key={m} value={m}>
                          {m === 1440 ? "Midnight" : formatMinutes(m)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <span className="label">Slot length</span>
                  <div className="segmented" role="radiogroup" aria-label="Slot length">
                    {SLOT_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={slotMinutes === s}
                        className={slotMinutes === s ? "active" : ""}
                        onClick={() => setSlotMinutes(s)}
                      >
                        {s === 60 ? "1 hr" : `${s} min`}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <span className="label">Time zone</span>
                  <TimezoneSelect value={timezone} onChange={setTimezone} variant="field" />
                </div>
              </div>
            </>
          )}
        </section>

        <section className="create-dates">
          <div className="field">
            <div className="label-row">
              <span className="label">Dates</span>
              {dates.size > 0 && (
                <button type="button" className="link-btn" onClick={() => setDates(new Set())}>
                  Clear
                </button>
              )}
            </div>
            <Calendar value={dates} onChange={setDates} />
            <p className="hint">
              {dates.size === 0
                ? "Click or drag across days to select them."
                : dates.size <= 3
                  ? sortedDates.map((d) => formatDayKey(d, { weekday: "short", month: "short", day: "numeric" })).join(" · ")
                  : `${dates.size} days selected`}
            </p>
          </div>
        </section>

        <footer className="create-footer">
          {error && <p className="error-text">{error}</p>}
          <button type="submit" className="btn btn-primary btn-lg" disabled={!canSubmit || submitting}>
            {submitting ? <Loader2 size={18} className="spin" /> : null}
            Create event
            {!submitting && <ArrowRight size={18} />}
          </button>
        </footer>
      </form>

    </div>
  );
}
