import { CalendarCheck, Download, X } from "lucide-react";
import { api, type EventData } from "../api";
import { describeRange } from "../lib/time";
import { useToast } from "./Toast";

function icsStamp(ms: number) {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** YYYYMMDD of an all-day slot (stored as the date's UTC midnight). */
function dateStamp(ms: number) {
  return new Date(ms).toISOString().slice(0, 10).replace(/-/g, "");
}

function icsTimes(event: EventData, start: number, end: number) {
  return event.kind === "days"
    ? [`DTSTART;VALUE=DATE:${dateStamp(start)}`, `DTEND;VALUE=DATE:${dateStamp(end)}`]
    : [`DTSTART:${icsStamp(start)}`, `DTEND:${icsStamp(end)}`];
}

function icsEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
}

function downloadIcs(event: EventData, start: number, end: number) {
  const url = `${window.location.origin}/e/${event.id}`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WIG//When is good//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event.id}-${start}@wig`,
    `DTSTAMP:${icsStamp(Date.now())}`,
    ...icsTimes(event, start, end),
    `SUMMARY:${icsEscape(event.title)}`,
    `DESCRIPTION:${icsEscape([event.description, url].filter(Boolean).join("\n\n"))}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${event.title.replace(/[^\w\- ]+/g, "").trim() || "event"}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function googleUrl(event: EventData, start: number, end: number) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates:
      event.kind === "days"
        ? `${dateStamp(start)}/${dateStamp(end)}`
        : `${icsStamp(start)}/${icsStamp(end)}`,
    details: [event.description, `${window.location.origin}/e/${event.id}`].filter(Boolean).join("\n\n"),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

interface Props {
  event: EventData;
  tz: string;
  adminKey: string | null;
  onChanged: () => Promise<unknown>;
}

export function FinalBanner({ event, tz, adminKey, onChanged }: Props) {
  const toast = useToast();
  if (!event.final) return null;
  const { start, end } = event.final;
  const { day, time } = describeRange(event.kind, start, end, tz);

  return (
    <div className="final-banner">
      <div className="final-icon" aria-hidden>
        <CalendarCheck size={20} />
      </div>
      <div className="final-text">
        <span className="final-label">It's decided</span>
        <span className="final-when">
          {day} · {time}
        </span>
      </div>
      <div className="final-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => downloadIcs(event, start, end)}>
          <Download size={14} /> .ics
        </button>
        <a className="btn btn-secondary btn-sm" href={googleUrl(event, start, end)} target="_blank" rel="noreferrer">
          Google Calendar
        </a>
        {adminKey && (
          <button
            type="button"
            className="icon-btn"
            aria-label="Clear final time"
            title="Clear final time"
            onClick={async () => {
              try {
                await api.updateEvent(event.id, adminKey, { final: null });
                await onChanged();
              } catch (err) {
                toast((err as Error).message, "error");
              }
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
