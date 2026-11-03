import { ArrowRight, PartyPopper } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { CopyField } from "../components/CopyField";
import { storage } from "../lib/storage";

export function CreatedPage() {
  const { id = "" } = useParams();
  const location = useLocation();
  const adminKey = (location.state as { adminKey?: string } | null)?.adminKey ?? storage.getAdminKey(id);
  const origin = window.location.origin;

  return (
    <div className="page narrow">
      <div className="card created-card">
        <div className="created-icon" aria-hidden>
          <PartyPopper size={22} />
        </div>
        <h1>Your event is ready</h1>
        <p className="muted">Share the participant link with your group. Everyone adds their availability, and you'll see the overlap instantly.</p>

        <div className="stack">
          <CopyField label="Participant link" hint="Send this to everyone" value={`${origin}/e/${id}`} />
          {adminKey && (
            <CopyField
              label="Organizer link"
              hint="Keep this private — it lets you manage the event"
              value={`${origin}/e/${id}/admin#${adminKey}`}
            />
          )}
        </div>

        <Link to={`/e/${id}`} className="btn btn-primary btn-lg block">
          Go to event <ArrowRight size={18} />
        </Link>
      </div>
    </div>
  );
}
