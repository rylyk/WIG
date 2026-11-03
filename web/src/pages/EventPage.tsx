import { CalendarDays, Check, Link2, Loader2, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError, type EventData } from "../api";
import { copyText } from "../components/CopyField";
import { FinalBanner } from "../components/FinalBanner";
import { ManagePanel } from "../components/ManagePanel";
import { RespondPanel } from "../components/RespondPanel";
import { ResultsPanel } from "../components/ResultsPanel";
import { buildGrid } from "../lib/grid";
import { storage, type StoredResponse } from "../lib/storage";
import { localTimeZone, summarizeDates } from "../lib/time";
import { NotFound } from "./NotFound";

type Tab = "respond" | "results" | "manage";

export function EventPage() {
  const { id = "" } = useParams();
  const [event, setEvent] = useState<EventData | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [adminKey, setAdminKey] = useState<string | null>(() => storage.getAdminKey(id));
  const [mine, setMine] = useState<StoredResponse | null>(() => storage.getResponse(id));
  const [tz, setTz] = useState(localTimeZone);
  const [tab, setTab] = useState<Tab | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getEvent(id);
      setEvent(data);
      setError(null);
      return data;
    } catch (err) {
      setError(err as ApiError);
      return null;
    }
  }, [id]);

  // Initial load + reconcile locally stored credentials with the server.
  useEffect(() => {
    let cancelled = false;
    load().then((data) => {
      if (!data || cancelled) return;
      const stored = storage.getResponse(id);
      const stillThere = stored && data.responses.some((r) => r.id === stored.id);
      if (stored && !stillThere) {
        storage.setResponse(id, null);
        setMine(null);
      }
      const key = storage.getAdminKey(id);
      storage.rememberEvent({ id, title: data.title, admin: !!key });
      setTab((t) => t ?? (stillThere || (key && data.responses.length > 0) ? "results" : "respond"));
      if (key) {
        api.verifyAdmin(id, key).catch((err) => {
          if (err.status === 403) {
            storage.setAdminKey(id, null);
            setAdminKey(null);
          }
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id, load]);

  // Keep results fresh while the page is open.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = window.setInterval(refresh, 20_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [load]);

  const model = useMemo(
    () => (event ? buildGrid(event.slots, event.slotMinutes, tz) : null),
    [event, tz],
  );

  if (error?.status === 404) return <NotFound message="This event doesn't exist or was deleted." />;
  if (!event || !model) {
    return (
      <div className="page center">
        {error ? <p className="error-text">{error.message}</p> : <Loader2 className="spin muted" size={24} />}
      </div>
    );
  }

  const myResponse = mine ? event.responses.find((r) => r.id === mine.id) : undefined;
  const isAdmin = !!adminKey;
  const shareUrl = `${window.location.origin}/e/${event.id}`;
  const count = event.responses.length;
  const activeTab: Tab = tab ?? "respond";

  return (
    <div className="page event-page">
      <header className="event-header">
        <div className="event-heading">
          <h1>{event.title}</h1>
          {event.description && <p className="event-description">{event.description}</p>}
          <div className="event-meta">
            <span>
              <CalendarDays size={15} /> {summarizeDates(event.dates)}
            </span>
            <span>
              <Users size={15} /> {count === 0 ? "No responses yet" : `${count} ${count === 1 ? "response" : "responses"}`}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={async () => {
            if (await copyText(shareUrl)) {
              setLinkCopied(true);
              setTimeout(() => setLinkCopied(false), 1600);
            }
          }}
        >
          {linkCopied ? <Check size={16} /> : <Link2 size={16} />}
          {linkCopied ? "Link copied" : "Copy link"}
        </button>
      </header>

      {event.final && (
        <FinalBanner
          event={event}
          tz={tz}
          adminKey={adminKey}
          onChanged={load}
        />
      )}

      <nav className="tabs" role="tablist">
        <TabButton active={activeTab === "respond"} onClick={() => setTab("respond")}>
          {myResponse ? "Your availability" : "Add availability"}
        </TabButton>
        <TabButton active={activeTab === "results"} onClick={() => setTab("results")}>
          Group results{count > 0 && <span className="tab-count">{count}</span>}
        </TabButton>
        {isAdmin && (
          <TabButton active={activeTab === "manage"} onClick={() => setTab("manage")}>
            Manage
          </TabButton>
        )}
      </nav>

      <div className="tab-panel" role="tabpanel">
        {activeTab === "respond" && (
          <RespondPanel
            key={myResponse?.id ?? "new"}
            event={event}
            model={model}
            tz={tz}
            onTzChange={setTz}
            myResponse={myResponse}
            stored={mine}
            onSaved={async (stored) => {
              storage.setResponse(event.id, stored);
              setMine(stored);
              await load();
              setTab("results");
            }}
            onForget={() => {
              storage.setResponse(event.id, null);
              setMine(null);
            }}
          />
        )}
        {activeTab === "results" && (
          <ResultsPanel
            event={event}
            model={model}
            tz={tz}
            onTzChange={setTz}
            adminKey={adminKey}
            myResponseId={myResponse?.id}
            onChanged={load}
            onRespond={() => setTab("respond")}
          />
        )}
        {activeTab === "manage" && adminKey && (
          <ManagePanel event={event} adminKey={adminKey} onChanged={load} />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" role="tab" aria-selected={active} className={`tab${active ? " active" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}
