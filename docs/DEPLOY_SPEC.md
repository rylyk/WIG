# Beta hosting spec

Goal: host WIG for a small group of invited beta testers, reachable over HTTPS at a
custom hostname, with no inbound ports open on the host and access limited to an
email allowlist. Not production grade: one host, no high availability.

## Target setup

```
friend's browser ──HTTPS──▶ Cloudflare (Access allowlist) ──tunnel──▶ cloudflared ─▶ web (nginx) ─▶ api ─▶ db
```

- **Host:** a small Ubuntu VPS (e.g. Hetzner CX22 / DigitalOcean 1 GB) or a spare home machine.
- **Ingress:** Cloudflare Tunnel (`cloudflared` container). No ports are published on the host.
- **Auth gate:** Cloudflare Access self-hosted application with an email allowlist
  (one-time PIN login, 30-day session).

## Inputs the owner provides

| Input | Example |
| ----- | ------- |
| Domain already on Cloudflare | `example.com` |
| Hostname for the app | `wig.example.com` |
| Tunnel token (Zero Trust → Networks → Tunnels → create) | `eyJh…` |
| Allowed tester emails | `a@x.com, b@y.com` |
| SSH access to the host | key-based |

Never commit the tunnel token or database password; they live only in `.env` on the host.

## Tasks

### 1. Repository changes

1. `docker-compose.yml`
   - Bind the web port to localhost only: `"127.0.0.1:${WEB_PORT:-8080}:80"`.
     (Docker-published ports bypass `ufw`, so a bare `8080:80` would be public.)
   - Add a `cloudflared` service under a `tunnel` profile so local development is unchanged:
     - image `cloudflare/cloudflared` pinned to a specific version tag (not `latest`)
     - `command: tunnel --no-autoupdate run`
     - `environment: TUNNEL_TOKEN: ${TUNNEL_TOKEN:?set TUNNEL_TOKEN in .env}`
     - `depends_on: web`, `restart: unless-stopped`, `profiles: ["tunnel"]`
2. `.env.example`: add `TUNNEL_TOKEN=` with a comment, and a note to change `POSTGRES_PASSWORD`.
3. `web/nginx.conf`
   - Rate-limit `/api/`: a `limit_req_zone` keyed on the real client IP at about 10 r/s with
     burst 20, returning 429. Behind Cloudflare, take the client IP from `CF-Connecting-IP`
     (`real_ip_header CF-Connecting-IP;` + `set_real_ip_from` the Docker network range).
   - Security headers on all responses: `X-Content-Type-Options: nosniff`,
     `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, and a
     `Content-Security-Policy` that allows only `'self'` for scripts, styles, fonts, images
     and connect (`style-src` may need `'unsafe-inline'` for React inline styles; verify).
   - `client_max_body_size 256k;` (matches the API's JSON limit).
4. `scripts/backup.sh`: `pg_dump` through `docker compose exec -T db`, gzip to
   `backups/wig-YYYY-MM-DD.sql.gz`, delete files older than 14 days. Add `backups/` to `.gitignore`.
5. `DEPLOY.md`: short operator guide covering everything in sections 2–4 below.

### 2. Host setup (document; run only with the owner's go-ahead)

- Create a non-root sudo user; SSH key login only (`PasswordAuthentication no`,
  `PermitRootLogin no`).
- `ufw default deny incoming`, `ufw allow OpenSSH`, `ufw enable`.
- Turn on `unattended-upgrades`.
- Install Docker Engine + Compose plugin from Docker's apt repository.
- Clone the repo, create `.env` with a strong random `POSTGRES_PASSWORD` (for example
  `openssl rand -base64 24`) and `TUNNEL_TOKEN`.
- Start: `docker compose --profile tunnel up -d --build`.
- Cron (daily, e.g. 03:17): `scripts/backup.sh`; copy backups off the host if possible.

### 3. Cloudflare setup (owner does this in the dashboard; document the clicks)

- Tunnel public hostname: `wig.example.com` → service `http://web:80`.
- Zero Trust → Access → Applications → Self-hosted for `wig.example.com`:
  policy *Allow*, include *Emails* = tester list; session duration 30 days;
  login method One-time PIN.

### 4. Updating

`git pull && docker compose --profile tunnel up -d --build`. Database data persists in
the `db-data` volume.

## Acceptance criteria

- [ ] `docker compose up -d --build` (no profile) still works locally at http://localhost:8080.
- [ ] On the host, `ss -tlnp` shows nothing listening publicly except SSH; port 8080 is
      bound to `127.0.0.1` only.
- [ ] `https://wig.example.com` shows the Cloudflare Access login; an allowlisted email
      gets in; any other email is refused.
- [ ] Creating an event, responding and viewing results work through the tunnel, and the
      "Copy link" buttons work (requires HTTPS).
- [ ] Response headers include the security headers above; the browser console shows no CSP errors.
- [ ] Rapid scripted requests to `/api/events` start receiving `429`.
- [ ] `scripts/backup.sh` produces a non-empty `.sql.gz` that restores into a fresh
      database (`gunzip -c … | docker compose exec -T db psql -U wig wig`).
- [ ] No secrets are committed (`git grep -i tunnel_token` finds only `.env.example` and docs).

## Out of scope

User accounts, multiple hosts or load balancing, managed Postgres, monitoring and alerting,
CI/CD.
