import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { storage, type RecentEvent } from "../lib/storage";

function EventList({ title, events }: { title: string; events: RecentEvent[] }) {
  if (events.length === 0) return null;
  return (
    <section className="recent">
      <h2 className="section-title">{title}</h2>
      <ul className="recent-list">
        {events.map((r) => (
          <li key={r.id}>
            <Link to={`/e/${r.id}`} className="recent-item">
              <span className="recent-title">{r.title}</span>
              <ArrowRight size={16} className="muted" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MyEventsPage() {
  const recent = storage.getRecent();
  const created = recent.filter((e) => e.admin);
  const invited = recent.filter((e) => !e.admin);

  return (
    <div className="page narrow">
      <h1>My events</h1>
      <p className="muted">Events you created or opened in this browser.</p>
      {recent.length === 0 ? (
        <div className="card empty-state">
          <p className="muted">No events yet. Events you create or open from a link will show up here.</p>
          <Link to="/" className="btn btn-primary">
            Create an event
          </Link>
        </div>
      ) : (
        <>
          <EventList title="Created by you" events={created} />
          <EventList title="Invited to" events={invited} />
        </>
      )}
    </div>
  );
}
