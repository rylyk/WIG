import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type EventData } from "../api";
import { storage } from "../lib/storage";
import { CopyField } from "./CopyField";
import { initials } from "./ResultsPanel";
import { useToast } from "./Toast";

interface Props {
  event: EventData;
  adminKey: string;
  onChanged: () => Promise<unknown>;
}

export function ManagePanel({ event, adminKey, onChanged }: Props) {
  const toast = useToast();
  const navigate = useNavigate();
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description);
  const [saving, setSaving] = useState(false);
  const origin = window.location.origin;
  const dirty = title.trim() !== event.title || description.trim() !== event.description;

  const saveDetails = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await api.updateEvent(event.id, adminKey, { title: title.trim(), description: description.trim() });
      await onChanged();
      storage.rememberEvent({ id: event.id, title: title.trim(), admin: true });
      toast("Event updated");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const removeResponse = async (id: string, name: string) => {
    if (!window.confirm(`Remove ${name}'s response?`)) return;
    try {
      await api.deleteResponse(event.id, id, { adminKey });
      await onChanged();
      toast(`Removed ${name}`);
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  const deleteEvent = async () => {
    if (!window.confirm("Delete this event and all responses? This can't be undone.")) return;
    try {
      await api.deleteEvent(event.id, adminKey);
      storage.forgetEvent(event.id);
      navigate("/", { replace: true });
      toast("Event deleted");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  return (
    <div className="manage">
      <section className="card manage-section">
        <h2 className="section-title">Links</h2>
        <div className="stack">
          <CopyField label="Participant link" hint="Share with your group" value={`${origin}/e/${event.id}`} />
          <CopyField
            label="Organizer link"
            hint="Private — opens this Manage view on any device"
            value={`${origin}/e/${event.id}/admin#${adminKey}`}
          />
        </div>
      </section>

      <section className="card manage-section">
        <h2 className="section-title">Details</h2>
        <div className="stack">
          <div className="field">
            <label htmlFor="m-title">Event name</label>
            <input id="m-title" className="input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="m-desc">Details</label>
            <textarea id="m-desc" className="input" rows={3} value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <button type="button" className="btn btn-primary" disabled={!dirty || saving || !title.trim()} onClick={saveDetails}>
              {saving && <Loader2 size={16} className="spin" />} Save changes
            </button>
          </div>
        </div>
      </section>

      <section className="card manage-section">
        <h2 className="section-title">Responses</h2>
        {event.responses.length === 0 ? (
          <p className="muted small">No one has responded yet.</p>
        ) : (
          <ul className="manage-responses">
            {event.responses.map((r) => (
              <li key={r.id}>
                <span className="avatar">{initials(r.name)}</span>
                <span className="person-name">{r.name}</span>
                <span className="muted small">
                  {new Date(r.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
                <button type="button" className="icon-btn" aria-label={`Remove ${r.name}`} title="Remove response" onClick={() => removeResponse(r.id, r.name)}>
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card manage-section danger">
        <div>
          <h2 className="section-title">Delete event</h2>
          <p className="muted small">Permanently removes the event and every response.</p>
        </div>
        <button type="button" className="btn btn-danger" onClick={deleteEvent}>
          Delete event
        </button>
      </section>
    </div>
  );
}
