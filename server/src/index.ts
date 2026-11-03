import express, { type NextFunction, type Request, type Response } from "express";
import { DateTime } from "luxon";
import { z } from "zod";
import { migrate, pool } from "./db.js";
import { hashSecret, randomId, secretMatches } from "./security.js";
import { generateSlots, isValidZone } from "./slots.js";

const MAX_DATES = 62;
const MAX_SLOTS = 4000;

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true);
app.use(express.json({ limit: "256kb" }));

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Handler = (req: Request, res: Response) => Promise<unknown>;
const route = (fn: Handler) => (req: Request, res: Response, next: NextFunction) =>
  fn(req, res).catch(next);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must be YYYY-MM-DD");

const createEventSchema = z
  .object({
    title: z.string().trim().min(1, "Give your event a name").max(120),
    description: z.string().trim().max(2000).default(""),
    dates: z.array(isoDate).min(1, "Pick at least one date").max(MAX_DATES),
    startMinute: z.number().int().min(0).max(1440),
    endMinute: z.number().int().min(0).max(1440),
    slotMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]),
    timezone: z.string().refine(isValidZone, "Unknown timezone"),
  })
  .refine((v) => v.endMinute > v.startMinute, {
    message: "End time must be after start time",
    path: ["endMinute"],
  })
  .refine((v) => v.endMinute - v.startMinute >= v.slotMinutes, {
    message: "Time range is shorter than one slot",
    path: ["endMinute"],
  });

const updateEventSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  final: z
    .object({ start: z.number().int(), end: z.number().int() })
    .refine((v) => v.end > v.start, "Invalid range")
    .nullable()
    .optional(),
});

const responseSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(60),
  available: z.array(z.number().int()).max(MAX_SLOTS),
  maybe: z.array(z.number().int()).max(MAX_SLOTS).default([]),
});

function parse<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new HttpError(400, result.error.issues[0]?.message ?? "Invalid request");
  }
  return result.data;
}

interface EventRow {
  id: string;
  admin_key_hash: string;
  title: string;
  description: string;
  timezone: string;
  dates: string[];
  start_minute: number;
  end_minute: number;
  slot_minutes: number;
  slots: number[];
  final_start: number | null;
  final_end: number | null;
  created_at: Date;
}

interface ResponseRow {
  id: string;
  name: string;
  edit_token_hash: string;
  available: number[];
  maybe: number[];
  created_at: Date;
  updated_at: Date;
}

async function loadEvent(id: string): Promise<EventRow> {
  const { rows } = await pool.query<EventRow>("SELECT * FROM events WHERE id = $1", [id]);
  if (!rows[0]) throw new HttpError(404, "Event not found");
  return rows[0];
}

function requireAdmin(req: Request, event: EventRow) {
  if (!secretMatches(req.get("x-admin-key"), event.admin_key_hash)) {
    throw new HttpError(403, "Admin key required");
  }
}

/** Keep only slots that belong to the event, de-duplicated and sorted. */
function cleanSlots(values: number[], valid: Set<number>): number[] {
  return [...new Set(values.filter((v) => valid.has(v)))].sort((a, b) => a - b);
}

function serializeEvent(event: EventRow, responses: ResponseRow[]) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    timezone: event.timezone,
    dates: event.dates,
    startMinute: event.start_minute,
    endMinute: event.end_minute,
    slotMinutes: event.slot_minutes,
    slots: event.slots,
    final:
      event.final_start != null && event.final_end != null
        ? { start: event.final_start, end: event.final_end }
        : null,
    createdAt: event.created_at.toISOString(),
    responses: responses.map((r) => ({
      id: r.id,
      name: r.name,
      available: r.available,
      maybe: r.maybe,
      updatedAt: r.updated_at.toISOString(),
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

app.get("/api/health", route(async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true });
}));

app.post("/api/events", route(async (req, res) => {
  const body = parse(createEventSchema, req.body);
  const dates = [...new Set(body.dates)].sort();
  for (const d of dates) {
    if (!DateTime.fromISO(d).isValid) throw new HttpError(400, `Invalid date ${d}`);
  }
  const slots = generateSlots({ ...body, dates });
  if (slots.length === 0) throw new HttpError(400, "No time slots in that range");
  if (slots.length > MAX_SLOTS) {
    throw new HttpError(400, "That's too many time slots — try fewer dates or a larger slot size");
  }

  const id = randomId(10);
  const adminKey = randomId(24);
  await pool.query(
    `INSERT INTO events (id, admin_key_hash, title, description, timezone, dates,
       start_minute, end_minute, slot_minutes, slots)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, hashSecret(adminKey), body.title, body.description, body.timezone, dates,
      body.startMinute, body.endMinute, body.slotMinutes, slots],
  );
  res.status(201).json({ id, adminKey });
}));

app.get("/api/events/:id", route(async (req, res) => {
  const event = await loadEvent(req.params.id);
  const { rows } = await pool.query<ResponseRow>(
    "SELECT * FROM responses WHERE event_id = $1 ORDER BY created_at",
    [event.id],
  );
  res.json(serializeEvent(event, rows));
}));

app.get("/api/events/:id/admin", route(async (req, res) => {
  const event = await loadEvent(req.params.id);
  requireAdmin(req, event);
  res.json({ ok: true });
}));

app.patch("/api/events/:id", route(async (req, res) => {
  const event = await loadEvent(req.params.id);
  requireAdmin(req, event);
  const body = parse(updateEventSchema, req.body);

  if (body.final) {
    const step = event.slot_minutes * 60_000;
    const valid = new Set(event.slots);
    const lastEnd = Math.max(...event.slots) + step;
    if (!valid.has(body.final.start) || body.final.end > lastEnd) {
      throw new HttpError(400, "Final time must be one of the event's time slots");
    }
  }

  const final = body.final === undefined
    ? { start: event.final_start, end: event.final_end }
    : { start: body.final?.start ?? null, end: body.final?.end ?? null };

  await pool.query(
    `UPDATE events SET title = $2, description = $3, final_start = $4, final_end = $5,
       updated_at = now() WHERE id = $1`,
    [event.id, body.title ?? event.title, body.description ?? event.description,
      final.start, final.end],
  );
  res.json({ ok: true });
}));

app.delete("/api/events/:id", route(async (req, res) => {
  const event = await loadEvent(req.params.id);
  requireAdmin(req, event);
  await pool.query("DELETE FROM events WHERE id = $1", [event.id]);
  res.status(204).end();
}));

app.post("/api/events/:id/responses", route(async (req, res) => {
  const event = await loadEvent(req.params.id);
  const body = parse(responseSchema, req.body);
  const valid = new Set(event.slots);
  const available = cleanSlots(body.available, valid);
  const availableSet = new Set(available);
  const maybe = cleanSlots(body.maybe, valid).filter((s) => !availableSet.has(s));

  const id = randomId(10);
  const editToken = randomId(24);
  await pool.query(
    `INSERT INTO responses (id, event_id, name, edit_token_hash, available, maybe)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, event.id, body.name, hashSecret(editToken), available, maybe],
  );
  res.status(201).json({ id, editToken });
}));

async function loadResponseForEdit(req: Request) {
  const event = await loadEvent(req.params.id);
  const { rows } = await pool.query<ResponseRow>(
    "SELECT * FROM responses WHERE id = $1 AND event_id = $2",
    [req.params.responseId, event.id],
  );
  const response = rows[0];
  if (!response) throw new HttpError(404, "Response not found");
  const isOwner = secretMatches(req.get("x-edit-token"), response.edit_token_hash);
  const isAdmin = secretMatches(req.get("x-admin-key"), event.admin_key_hash);
  if (!isOwner && !isAdmin) throw new HttpError(403, "Not allowed to edit this response");
  return { event, response };
}

app.put("/api/events/:id/responses/:responseId", route(async (req, res) => {
  const { event, response } = await loadResponseForEdit(req);
  const body = parse(responseSchema, req.body);
  const valid = new Set(event.slots);
  const available = cleanSlots(body.available, valid);
  const availableSet = new Set(available);
  const maybe = cleanSlots(body.maybe, valid).filter((s) => !availableSet.has(s));

  await pool.query(
    `UPDATE responses SET name = $2, available = $3, maybe = $4, updated_at = now()
     WHERE id = $1`,
    [response.id, body.name, available, maybe],
  );
  res.json({ ok: true });
}));

app.delete("/api/events/:id/responses/:responseId", route(async (req, res) => {
  const { response } = await loadResponseForEdit(req);
  await pool.query("DELETE FROM responses WHERE id = $1", [response.id]);
  res.status(204).end();
}));

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof SyntaxError) {
    res.status(400).json({ error: "Malformed JSON" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

/* ------------------------------------------------------------------ */

const port = Number(process.env.PORT ?? 3000);

await migrate();
const server = app.listen(port, () => {
  console.log(`API listening on :${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      void pool.end().then(() => process.exit(0));
    });
  });
}
