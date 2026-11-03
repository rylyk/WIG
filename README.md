# WIG — when is good?

A modern take on [whenisgood](https://whenisgood.net): pick some dates, share a link,
and see when your group is free. No accounts.

## Quick start

```bash
docker compose up -d --build
```

Then open <http://localhost:8080>.

To use a different port or database credentials, copy `.env.example` to `.env` and edit it.

| Service | What it runs | Notes |
| ------- | ------------ | ----- |
| `web`   | nginx serving the React app, proxying `/api` to `api` | Published on `${WEB_PORT:-8080}` |
| `api`   | Node 22 + Express REST API | Creates its tables on startup |
| `db`    | PostgreSQL 16 | Data persists in the `db-data` volume |

Stop with `docker compose down` (add `-v` to also delete the data).

## Features

- **Create an event**: name, optional details, drag across a calendar to pick dates,
  a time-of-day range, 15/30/60-minute slots, and a time zone.
- **Two links**: a participant link to share and a private organizer link (`/e/:id/admin#key`).
  The key stays in the URL fragment, so it never ends up in server logs.
- **Paint availability**: click-and-drag rectangles over the grid, mark times as
  *Available* or *If needed*, click a day header to toggle the whole day. Works with
  touch and with the keyboard (arrow keys + space).
- **Group results**: a heatmap of overlap, the top three "best times", and a participant
  list that shows who's free in the hovered/tapped slot. Hover a name to see their
  availability; click a name to leave them out of the results.
- **Time zones**: slots are stored as UTC instants. Everyone sees the grid in their own
  zone and can switch to any other.
- **Organizer tools**: choose the final time (everyone sees it, with `.ics` and Google
  Calendar links), edit details, remove responses, delete the event.
- Participants can come back and edit their own response from the same browser.
- Light and dark mode follow the system setting.

## Local development

Run Postgres (for example `docker compose up -d db` with a port mapping added, or a local
install), then:

```bash
cd server && npm install && DATABASE_URL=postgres://wig:wig@localhost:5432/wig npm run dev
```

```bash
cd web && npm install && npm run dev
```

The Vite dev server runs on <http://localhost:5173> and proxies `/api` to `localhost:3000`.

## API

| Method | Path | Auth |
| ------ | ---- | ---- |
| `POST` | `/api/events` | — returns `{ id, adminKey }` |
| `GET` | `/api/events/:id` | — event, slots and responses |
| `GET` | `/api/events/:id/admin` | `X-Admin-Key` (checks the key) |
| `PATCH` | `/api/events/:id` | `X-Admin-Key` (title, description, final time) |
| `DELETE` | `/api/events/:id` | `X-Admin-Key` |
| `POST` | `/api/events/:id/responses` | — returns `{ id, editToken }` |
| `PUT` | `/api/events/:id/responses/:rid` | `X-Edit-Token` or `X-Admin-Key` |
| `DELETE` | `/api/events/:id/responses/:rid` | `X-Edit-Token` or `X-Admin-Key` |

Admin keys and edit tokens are stored only as SHA-256 hashes.

## Project layout

```
docker-compose.yml
server/   Express API (TypeScript): src/index.ts routes, src/slots.ts time-zone math, src/db.ts schema
web/      React + Vite app (TypeScript): src/pages, src/components, src/lib, src/styles.css
```
