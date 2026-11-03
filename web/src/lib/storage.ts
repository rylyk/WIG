// Small, failure-tolerant wrappers around localStorage. Private windows and
// blocked storage must never break the app, so every access is guarded.

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export interface StoredResponse {
  id: string;
  token: string;
}

export interface RecentEvent {
  id: string;
  title: string;
  admin: boolean;
  at: number;
}

export const storage = {
  getAdminKey: (eventId: string) => read<string>(`wig:admin:${eventId}`),
  setAdminKey: (eventId: string, key: string | null) => write(`wig:admin:${eventId}`, key),

  getResponse: (eventId: string) => read<StoredResponse>(`wig:resp:${eventId}`),
  setResponse: (eventId: string, value: StoredResponse | null) =>
    write(`wig:resp:${eventId}`, value),

  getName: () => read<string>("wig:name") ?? "",
  setName: (name: string) => write("wig:name", name),

  getRecent: () => read<RecentEvent[]>("wig:recent") ?? [],
  rememberEvent(event: Omit<RecentEvent, "at">) {
    const list = this.getRecent().filter((e) => e.id !== event.id);
    const prev = this.getRecent().find((e) => e.id === event.id);
    list.unshift({ ...event, admin: event.admin || !!prev?.admin, at: Date.now() });
    // Never drop events you organize: losing the entry means losing the way back.
    const visited = list.filter((e) => !e.admin).slice(0, 30);
    write("wig:recent", list.filter((e) => e.admin || visited.includes(e)));
  },
  forgetEvent(eventId: string) {
    write("wig:recent", this.getRecent().filter((e) => e.id !== eventId));
    write(`wig:admin:${eventId}`, null);
    write(`wig:resp:${eventId}`, null);
  },
};
