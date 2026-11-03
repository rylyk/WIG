import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { api, type EventData, type ParticipantResponse } from "../api";
import type { GridModel, Status } from "../lib/grid";
import { storage, type StoredResponse } from "../lib/storage";
import { AvailabilityGrid } from "./AvailabilityGrid";
import { AvailabilityMonth } from "./AvailabilityMonth";
import { useToast } from "./Toast";
import { TimezoneSelect } from "./TimezoneSelect";

interface Props {
  event: EventData;
  model: GridModel;
  tz: string;
  onTzChange: (tz: string) => void;
  myResponse?: ParticipantResponse;
  stored: StoredResponse | null;
  onSaved: (stored: StoredResponse) => Promise<void>;
  onForget: () => void;
}

function initialValue(r?: ParticipantResponse) {
  const m = new Map<number, Status>();
  r?.maybe.forEach((s) => m.set(s, 1));
  r?.available.forEach((s) => m.set(s, 2));
  return m;
}

export function RespondPanel({ event, model, tz, onTzChange, myResponse, stored, onSaved, onForget }: Props) {
  const toast = useToast();
  const [name, setName] = useState(() => myResponse?.name ?? storage.getName());
  const [value, setValue] = useState(() => initialValue(myResponse));
  const [paint, setPaint] = useState<Status>(2);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableCount = [...value.values()].filter((v) => v === 2).length;
  const maybeCount = value.size - availableCount;
  const isDays = event.kind === "days";
  const amount = (n: number) => {
    if (isDays) return `${n} day${n === 1 ? "" : "s"}`;
    const h = (n * event.slotMinutes) / 60;
    return `${Number.isInteger(h) ? h : h.toFixed(1)} hr${h === 1 ? "" : "s"}`;
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter your name so others know who's available.");
      document.getElementById("respond-name")?.focus();
      return;
    }
    setSaving(true);
    setError(null);
    const input = {
      name: trimmed,
      available: [...value].filter(([, v]) => v === 2).map(([s]) => s),
      maybe: [...value].filter(([, v]) => v === 1).map(([s]) => s),
    };
    try {
      let next: StoredResponse;
      if (myResponse && stored) {
        await api.updateResponse(event.id, myResponse.id, input, { editToken: stored.token });
        next = stored;
      } else {
        const res = await api.addResponse(event.id, input);
        next = { id: res.id, token: res.editToken };
      }
      storage.setName(trimmed);
      await onSaved(next);
      toast(myResponse ? "Your availability was updated" : "Thanks! Your availability was saved");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!myResponse || !stored) return;
    if (!window.confirm("Remove your response from this event?")) return;
    try {
      await api.deleteResponse(event.id, myResponse.id, { editToken: stored.token });
      onForget();
      setValue(new Map());
      toast("Your response was removed");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  return (
    <div className="respond">
      <div className="respond-top">
        <div className="field name-field">
          <label htmlFor="respond-name">Your name</label>
          <input
            id="respond-name"
            className="input"
            placeholder="e.g. Alex"
            value={name}
            maxLength={60}
            autoComplete="name"
            onChange={(e) => setName(e.target.value)}
          />
          {myResponse && (
            <p className="hint">
              Editing your saved response.{" "}
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  onForget();
                  setName("");
                  setValue(new Map());
                }}
              >
                Not you?
              </button>
            </p>
          )}
        </div>

        <div className="field">
          <span className="label">Paint as</span>
          <div className="segmented" role="radiogroup" aria-label="Paint mode">
            <button
              type="button"
              role="radio"
              aria-checked={paint === 2}
              className={paint === 2 ? "active" : ""}
              onClick={() => setPaint(2)}
            >
              <span className="dot avail" /> Available
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={paint === 1}
              className={paint === 1 ? "active" : ""}
              onClick={() => setPaint(1)}
            >
              <span className="dot maybe" /> If needed
            </button>
          </div>
        </div>
      </div>

      <p className="hint respond-hint">
        {isDays
          ? "Tap the days you're free, or drag across several at once. Tap a marked day again to clear it."
          : "Click and drag across the grid to mark when you're free. Drag over marked times to clear them."}
      </p>

      {isDays ? (
        <AvailabilityMonth dates={event.dates} value={value} onChange={setValue} paint={paint} />
      ) : (
        <AvailabilityGrid
          model={model}
          slotMinutes={event.slotMinutes}
          value={value}
          onChange={setValue}
          paint={paint}
          toolbar={<TimezoneSelect value={tz} onChange={onTzChange} />}
        />
      )}

      <div className="save-bar">
        <div className="save-summary">
          {value.size === 0 ? (
            <span className="muted">No times selected yet</span>
          ) : (
            <>
              <span>
                <span className="dot avail" /> {amount(availableCount)} available
              </span>
              {maybeCount > 0 && (
                <span>
                  <span className="dot maybe" /> {amount(maybeCount)} if needed
                </span>
              )}
            </>
          )}
        </div>
        <div className="save-actions">
          {error && <span className="error-text">{error}</span>}
          {myResponse && (
            <button type="button" className="icon-btn" title="Remove my response" aria-label="Remove my response" onClick={remove}>
              <Trash2 size={17} />
            </button>
          )}
          {value.size > 0 && (
            <button type="button" className="btn btn-ghost" onClick={() => setValue(new Map())}>
              Clear
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
            {saving && <Loader2 size={16} className="spin" />}
            {myResponse ? "Update" : "Save availability"}
          </button>
        </div>
      </div>
    </div>
  );
}
