import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { storage } from "../lib/storage";

/** Handles organizer links of the form /e/:id/admin#<key>. */
export function AdminEntry() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const key = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (!key) {
      setError("This organizer link is missing its key.");
      return;
    }
    api
      .verifyAdmin(id, key)
      .then(() => {
        storage.setAdminKey(id, key);
        navigate(`/e/${id}`, { replace: true });
      })
      .catch((err) => setError(err.status === 403 ? "This organizer link isn't valid." : err.message));
  }, [id, navigate]);

  return (
    <div className="page narrow center">
      {error ? (
        <div className="card empty-state">
          <h1>Couldn't open organizer view</h1>
          <p className="muted">{error}</p>
          <Link to={`/e/${id}`} className="btn btn-secondary">
            View event
          </Link>
        </div>
      ) : (
        <Loader2 className="spin muted" size={24} />
      )}
    </div>
  );
}
