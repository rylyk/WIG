import pg from "pg";

// Return BIGINT and BIGINT[] as JS numbers. All bigint values we store are
// epoch milliseconds, which are well within Number.MAX_SAFE_INTEGER.
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1016, (v) =>
  v === "{}" ? [] : v.slice(1, -1).split(",").map(Number),
);

export const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ?? "postgres://wig:wig@localhost:5432/wig",
  max: 10,
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
  id              TEXT PRIMARY KEY,
  admin_key_hash  TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  timezone        TEXT NOT NULL,
  dates           TEXT[] NOT NULL,
  start_minute    INT NOT NULL,
  end_minute      INT NOT NULL,
  slot_minutes    INT NOT NULL,
  slots           BIGINT[] NOT NULL,
  final_start     BIGINT,
  final_end       BIGINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS responses (
  id               TEXT PRIMARY KEY,
  event_id         TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  edit_token_hash  TEXT NOT NULL,
  available        BIGINT[] NOT NULL DEFAULT '{}',
  maybe            BIGINT[] NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS responses_event_id_idx ON responses(event_id);
`;

export async function migrate(retries = 30): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query(SCHEMA);
      return;
    } catch (err) {
      if (attempt >= retries) throw err;
      console.log(`Database not ready (attempt ${attempt}/${retries}), retrying…`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}
