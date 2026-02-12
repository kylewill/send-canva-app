# Send Canva App

A Canva Content Publisher app that lets users create tracked document links directly from Canva's Share menu. Built as a POC for [send.co](https://send.co) integration.

**Design in Canva → Share → Send → Get a tracked link → See who viewed it**

## Live URLs

| Service | URL |
|---------|-----|
| Worker API | https://send-canva-worker.brickstack.workers.dev |
| Example Viewer | https://send-canva-worker.brickstack.workers.dev/view/test-proposal |
| Example Stats | https://send-canva-worker.brickstack.workers.dev/stats/test-proposal |

## How It Works

1. User finishes a design in Canva
2. Opens **Share menu** → selects **Send**
3. Configures: custom slug, allow download, allow print
4. Clicks **Publish** → Canva exports the design as PDF
5. PDF is stored in Cloudflare R2, a tracking record is created in D1
6. User gets a link: `/view/:slug` (share with recipients) and `/stats/:slug` (view analytics)
7. When recipients open the link, views are tracked (IP, browser, timestamp)

## Project Structure

```
send-canva-app/
├── canva-app/                          # Canva app (React + TypeScript)
│   ├── src/
│   │   ├── index.tsx                   # Entry — registers Design Editor + Content Publisher intents
│   │   └── intents/content_publisher/
│   │       ├── index.tsx               # Intent config: PDF export, publish to Workers API
│   │       ├── settings_ui.tsx         # Settings panel: slug, download, print toggles
│   │       ├── preview_ui.tsx          # Preview wrapper
│   │       ├── post_preview.tsx        # Document preview with thumbnail + link preview
│   │       └── types.ts               # PublishSettings type
│   └── canva-app.json                  # Manifest: design_editor + content_publisher intents
│
├── worker/                             # Cloudflare Workers backend (Hono)
│   ├── src/
│   │   ├── index.ts                    # Hono app entry, route mounting, CORS
│   │   ├── routes/
│   │   │   ├── publish.ts             # POST /api/publish — download PDF, store in R2, create D1 record
│   │   │   ├── track.ts              # POST /api/track — record view event
│   │   │   └── file.ts               # GET /api/file/:id — serve PDF from R2
│   │   ├── pages/
│   │   │   ├── viewer.ts             # GET /view/:slug — PDF viewer (PDF.js + send.co-style UI)
│   │   │   └── stats.ts              # GET /stats/:slug — analytics page (views, IPs, timeline)
│   │   └── db/
│   │       └── schema.sql             # D1 schema: documents + views tables
│   └── wrangler.toml                   # Workers config: R2, D1 bindings
│
├── PLAN.md                             # Architecture, status, and learnings
└── README.md
```

## Development

### Prerequisites

- Node.js v20.10+
- npm v10+
- [Canva CLI](https://www.npmjs.com/package/@canva/cli): `npm install -g @canva/cli@latest`
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/): installed as dev dependency in `worker/`

### Canva App (local dev)

```bash
cd canva-app
cp .env.template .env
# Set CANVA_APP_ID=AAHAAMMv83Q in .env (already done)
npm install
npm start
# App runs at http://localhost:8080
```

Then in the [Canva Developer Portal](https://www.canva.com/developers/apps):
1. Open your app → **Code upload** → **Development URL** → `http://localhost:8080`
2. Click **Preview** to open the Canva editor with the app loaded
3. Open the **Share menu** to find the Send app

### Worker Backend (local dev)

```bash
cd worker
npm install

# Run D1 migration locally
npx wrangler d1 execute send-canva-db --local --file=src/db/schema.sql

# Start dev server
npx wrangler dev --port 8788
```

Test locally:
```bash
# Health check
curl http://localhost:8788/

# Publish a test document
curl -X POST http://localhost:8788/api/publish \
  -H "Content-Type: application/json" \
  -d '{"fileUrl": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", "title": "Test Doc", "slug": "test-doc"}'

# Open viewer
open http://localhost:8788/view/test-doc

# Check stats
open http://localhost:8788/stats/test-doc
```

## Deployment

### Worker (Cloudflare)

```bash
cd worker

# First time: create resources
npx wrangler r2 bucket create send-canva-files
npx wrangler d1 create send-canva-db
# Update database_id in wrangler.toml with the ID from d1 create output

# Run migration on remote DB
npx wrangler d1 execute send-canva-db --remote --file=src/db/schema.sql

# Deploy
npx wrangler deploy
```

### Canva App

```bash
cd canva-app
canva apps deploy
```

## Cloudflare Resources

| Resource | Name | Type |
|----------|------|------|
| Worker | `send-canva-worker` | Workers |
| Bucket | `send-canva-files` | R2 |
| Database | `send-canva-db` | D1 (ID: `26ec631f-f1ad-4799-a646-1ddee5682eb5`) |

## API Reference

### POST /api/publish

Receives an exported file, stores it, and creates a tracked link.

```json
{
  "fileUrl": "https://...",
  "title": "My Proposal",
  "slug": "my-proposal",
  "allowDownload": true,
  "allowPrint": false
}
```

Returns:
```json
{
  "id": "BuSBH5ViGQH1",
  "slug": "my-proposal",
  "viewUrl": "https://send-canva-worker.brickstack.workers.dev/view/my-proposal",
  "statsUrl": "https://send-canva-worker.brickstack.workers.dev/stats/my-proposal"
}
```

### POST /api/track

Records a view event.

```json
{ "documentId": "BuSBH5ViGQH1" }
```

### GET /api/file/:id

Serves the PDF from R2. Respects `allow_download` setting (inline vs attachment disposition).

### GET /view/:slug

Public viewer page. Renders PDF with PDF.js. Automatically records a view on load. Respects download/print permissions.

### GET /stats/:slug

Analytics page. Shows total views, unique viewers (by IP), last viewed time, and a table of all views with timestamps, masked IPs, browser, and referrer.
