import { Check, Copy } from "lucide-react";
import { useState } from "react";

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for non-secure contexts (e.g. plain http on a LAN address).
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function CopyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-field">
      <div className="copy-field-label">
        <span>{label}</span>
        {hint && <span className="muted small">{hint}</span>}
      </div>
      <div className="copy-field-row">
        <input readOnly value={value} onFocus={(e) => e.currentTarget.select()} aria-label={label} />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={async () => {
            if (await copyText(value)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            }
          }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
