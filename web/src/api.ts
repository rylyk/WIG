export interface ParticipantResponse {
  id: string;
  name: string;
  available: number[];
  maybe: number[];
  updatedAt: string;
}

export interface EventData {
  id: string;
  title: string;
  description: string;
  timezone: string;
  dates: string[];
  startMinute: number;
  endMinute: number;
  slotMinutes: number;
  slots: number[];
  final: { start: number; end: number } | null;
  createdAt: string;
  responses: ParticipantResponse[];
}

export interface CreateEventInput {
  title: string;
  description: string;
  dates: string[];
  startMinute: number;
  endMinute: number;
  slotMinutes: 15 | 30 | 60;
  timezone: string;
}

export interface ResponseInput {
  name: string;
  available: number[];
  maybe: number[];
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? "GET",
      headers: {
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  return data as T;
}

const adminHeaders = (key: string) => ({ "X-Admin-Key": key });

export const api = {
  createEvent: (input: CreateEventInput) =>
    request<{ id: string; adminKey: string }>("/events", { method: "POST", body: input }),

  getEvent: (id: string) => request<EventData>(`/events/${encodeURIComponent(id)}`),

  verifyAdmin: (id: string, key: string) =>
    request<{ ok: true }>(`/events/${encodeURIComponent(id)}/admin`, {
      headers: adminHeaders(key),
    }),

  updateEvent: (
    id: string,
    key: string,
    patch: { title?: string; description?: string; final?: { start: number; end: number } | null },
  ) =>
    request<{ ok: true }>(`/events/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: patch,
      headers: adminHeaders(key),
    }),

  deleteEvent: (id: string, key: string) =>
    request<void>(`/events/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: adminHeaders(key),
    }),

  addResponse: (id: string, input: ResponseInput) =>
    request<{ id: string; editToken: string }>(`/events/${encodeURIComponent(id)}/responses`, {
      method: "POST",
      body: input,
    }),

  updateResponse: (
    id: string,
    responseId: string,
    input: ResponseInput,
    auth: { editToken?: string; adminKey?: string },
  ) =>
    request<{ ok: true }>(
      `/events/${encodeURIComponent(id)}/responses/${encodeURIComponent(responseId)}`,
      {
        method: "PUT",
        body: input,
        headers: {
          ...(auth.editToken ? { "X-Edit-Token": auth.editToken } : {}),
          ...(auth.adminKey ? adminHeaders(auth.adminKey) : {}),
        },
      },
    ),

  deleteResponse: (
    id: string,
    responseId: string,
    auth: { editToken?: string; adminKey?: string },
  ) =>
    request<void>(
      `/events/${encodeURIComponent(id)}/responses/${encodeURIComponent(responseId)}`,
      {
        method: "DELETE",
        headers: {
          ...(auth.editToken ? { "X-Edit-Token": auth.editToken } : {}),
          ...(auth.adminKey ? adminHeaders(auth.adminKey) : {}),
        },
      },
    ),
};
