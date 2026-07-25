# EyeMap Clinica (`clinica.eyemap.ai`)

Next.js clinic dashboard on **Vercel** + **Neon Postgres**, fundus images in **self-hosted MinIO** on this GPU machine, and a **Python worker** that runs **MedGemma** via **Ollama**.

The static marketing site at `eyemap.ai` (GitHub Pages) is unchanged. This app lives in `clinica/` and is deployed as a separate Vercel project (Root Directory = `clinica`).

## Architecture

```
Browser ──HTTPS──► Vercel (Next.js + Auth + APIs)
   │                    │
   │                    └── Neon Postgres (clinics, users, patients, cases)
   │
   └──presigned PUT──► Tailscale Funnel ──► MinIO (this machine)

Python worker (this machine)
   ├── POST /api/worker/claim   (Postgres SKIP LOCKED queue)
   ├── GET  image via localhost:9000
   ├── Ollama MedGemma inference
   └── POST /api/worker/callback
```

Dashboard polls case status every ~4s while jobs are queued/processing (no WebSockets on Vercel serverless).

## 1. Local development

```bash
cd clinica
cp .env.example .env.local
# fill DATABASE_URL, AUTH_SECRET, MINIO_*, WORKER_SHARED_SECRET

npm install
npm run db:push          # apply schema to Neon
npm run db:seed          # seed demo clinics/doctors (password from SEED_PASSWORD)
npm run dev              # http://localhost:3000
```

Generate a secret:

```bash
openssl rand -base64 32
```

Seed logins (default password `changeme123` unless `SEED_PASSWORD` is set):

| Email | Role | Clinic |
|-------|------|--------|
| `doctor@retinaclinic.ro` | doctor | Retina Clinic Bucharest |
| `admin@retinaclinic.ro` | admin | Retina Clinic Bucharest |
| `doctor@holhos.ro` | doctor | Clinic Dr. Holhoș |

## 2. MinIO on this machine

```bash
cd clinica/infra
# optional: export MINIO_ROOT_USER / MINIO_ROOT_PASSWORD
docker compose -f docker-compose.minio.yml up -d
```

- API: `http://127.0.0.1:9000`
- Console: `http://127.0.0.1:9001`
- Bucket: `fundus` (created by `minio-init`)

Use the same access key/secret in Vercel env (`MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY`).

### Tailscale Funnel (public HTTPS for browser uploads)

Browsers and Vercel cannot reach Tailscale IPs like `100.96.127.29`. Expose MinIO:

```bash
# Requires Tailscale Funnel enabled for your tailnet
tailscale funnel --bg 9000
tailscale funnel status
```

Set on Vercel:

- `MINIO_PUBLIC_ENDPOINT` = hostname from funnel status (no `https://`), e.g. `mybox.tailnet-name.ts.net`
- `MINIO_PUBLIC_PORT=443`
- `MINIO_PUBLIC_USE_SSL=true`
- `MINIO_INTERNAL_ENDPOINT=127.0.0.1` (worker downloads locally)
- `MINIO_INTERNAL_PORT=9000`
- `MINIO_INTERNAL_USE_SSL=false`

> Funnel serves HTTPS on 443 and forwards to local port 9000. Presigned URLs are signed against the public endpoint so the browser can PUT/GET images directly (bytes never pass through Vercel or the queue).

## 3. GPU worker (MedGemma / Ollama)

Prerequisites: Ollama running with a MedGemma vision model, e.g. `medgemma-27b-vision:latest` (Q4_K_M).

```bash
ollama list
cd clinica/worker
cp worker.env.example worker.env
# set CLINICA_API_BASE=https://clinica.eyemap.ai
# set WORKER_SHARED_SECRET to match Vercel

python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# foreground test
set -a && source worker.env && set +a
.venv/bin/python worker.py
```

Install as a user systemd service:

```bash
chmod +x install-systemd.sh
./install-systemd.sh
journalctl --user -u eyemap-worker -f
```

Worker behaviour:

1. Polls `POST /api/worker/claim` (atomic `FOR UPDATE SKIP LOCKED`)
2. Downloads image (prefers localhost MinIO URL)
3. Runs structured confidence scoring + narrative (`num_predict` capped at 512)
4. Posts `POST /api/worker/callback`
5. Failed jobs re-queue up to 3 attempts; stuck `processing` (>30 min) is re-queued

Extra GPU machines = same worker + same secret pointing at the same API.

## 4. Vercel + DNS

1. Import the `eyemap` GitHub repo into Vercel.
2. Set **Root Directory** to `clinica`.
3. Add **Neon** from the Vercel Marketplace (sets `DATABASE_URL`).
4. Set env vars from `.env.example` (`AUTH_SECRET`, MinIO, `WORKER_SHARED_SECRET`).
5. Deploy, then run migrations/seed once (from CI or locally against Neon):

   ```bash
   DATABASE_URL='...' npm run db:push
   DATABASE_URL='...' npm run db:seed
   ```

6. At your DNS host for `eyemap.ai`, add:

   ```
   CNAME  clinica  →  cname.vercel-dns.com
   ```

7. In Vercel → Domains, add `clinica.eyemap.ai`.

Apex `eyemap.ai` stays on GitHub Pages.

## 5. API summary

| Route | Auth | Purpose |
|-------|------|---------|
| `POST /api/upload` | Session | Create patient/case + MinIO presigned PUT URL |
| `POST /api/upload/confirm` | Session | Mark case `queued` (202) |
| `GET /api/cases` | Session | List clinic cases (polling) |
| `GET /api/cases/[id]` | Session | Case detail + image GET URL |
| `GET/POST /api/patients` | Session | Patient list / create |
| `POST /api/worker/claim` | `x-worker-secret` | Claim next queued task |
| `POST /api/worker/callback` | `x-worker-secret` | Save result / fail |

## 6. Security notes

- Passwords are bcrypt-hashed; never stored in Edge Config or Blob.
- Raw images stay in MinIO; Postgres holds keys + metadata + JSON results only.
- Clinic scoping is enforced from the JWT (`clinicId`) on every clinician API.
- Worker endpoints require a shared secret (rotate via env on Vercel + `worker.env`).
- Change all default passwords and MinIO keys before production use.
