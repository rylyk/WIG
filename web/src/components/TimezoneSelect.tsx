import { Globe } from "lucide-react";
import { useMemo } from "react";
import { allTimeZones, offsetLabel, prettyZone } from "../lib/time";

interface Props {
  value: string;
  onChange: (tz: string) => void;
  id?: string;
  variant?: "field" | "pill";
}

export function TimezoneSelect({ value, onChange, id, variant = "pill" }: Props) {
  const zones = useMemo(() => {
    const list = allTimeZones();
    if (!list.includes(value)) list.unshift(value);
    return list.map((tz) => ({ tz, label: `${prettyZone(tz)} (${offsetLabel(tz)})` }));
  }, [value]);

  return (
    <label className={`tz-select tz-${variant}`} title="Time zone">
      <Globe size={15} aria-hidden />
      <span className="tz-current">{variant === "pill" ? prettyZone(value).split(" / ").pop() : prettyZone(value)}</span>
      <span className="tz-offset">{offsetLabel(value)}</span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Time zone">
        {zones.map((z) => (
          <option key={z.tz} value={z.tz}>
            {z.label}
          </option>
        ))}
      </select>
    </label>
  );
}
