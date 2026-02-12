# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A POC Canva Content Publisher app for [send.co](https://send.co). Users share Canva designs via the Share menu → Send → get a tracked link. The Canva app (React) calls a Cloudflare Worker backend (Hono) that stores PDFs in R2 and tracks views in D1.

## Commands

### Canva App (`canva-app/`)

```bash
npm start              # Dev server on localhost:8080
npm run build          # Webpack production build
npm run lint           # ESLint
npm run lint:fix       # ESLint with auto-fix
npm run lint:types     # TypeScript type checking only
npm test               # Jest
npm run test:watch     # Jest watch mode
```

### Worker (`worker/`)

```bash
npx wrangler dev --port 8788   # Local dev server
npx wrangler deploy             # Deploy to Cloudflare
npx wrangler d1 execute send-canva-db --local --file=src/db/schema.sql   # Run local DB migration
npx wrangler d1 execute send-canva-db --remote --file=src/db/schema.sql  # Run remote DB migration
```

### Test without Canva

```bash
curl -X POST https://send-canva-worker.brickstack.workers.dev/api/publish \
  -H "Content-Type: application/json" \
  -d '{"fileUrl": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", "title": "Test", "slug": "test-doc"}'
```

## Architecture

```
canva-app/src/index.tsx → prepareContentPublisher(contentPublisher)
                                    ↓
              intents/content_publisher/index.tsx
              ├── getPublishConfiguration()     → tells Canva to export PDF
              ├── renderSettingsUi()            → mounts SettingsUi component
              ├── renderPreviewUi()             → mounts PreviewUi component
              └── publishContent(request)       → POSTs to Worker, returns URLs
                                    ↓
              worker/src/index.ts (Hono)
              ├── POST /api/publish  → download PDF from temp URL, store R2, create D1 record
              ├── POST /api/track    → record view event
              ├── GET  /api/file/:id → serve PDF from R2
              ├── GET  /view/:slug   → HTML viewer page (PDF.js)
              └── GET  /stats/:slug  → HTML analytics page
```

### Settings flow via `publishRef`

Settings travel as a JSON string through Canva's `publishRef` mechanism:

1. `SettingsUi` calls `updatePublishSettings({ publishRef: JSON.stringify(settings) })`
2. `PreviewUi` receives updated `publishRef` via `registerOnPreviewChange` callback
3. `publishContent()` gets final `publishRef` from `request.publishRef`, parses it
4. Worker receives parsed settings in the POST body

### Worker bindings

| Binding | Type | Name |
|---------|------|------|
| `BUCKET` | R2 | `send-canva-files` |
| `DB` | D1 | `send-canva-db` (ID: `26ec631f-f1ad-4799-a646-1ddee5682eb5`) |
| `BASE_URL` | var | `https://send-canva-worker.brickstack.workers.dev` |

## Canva SDK Gotchas

These are hard-won lessons — do not reintroduce these bugs:

- **`publishContent` error statuses**: Only `"app_error"` (requires `message` field) or `"remote_request_failed"`. Never `"error"`.
- **No `title` on `PublishContentRequest`**: Only `publishRef`, `outputType`, `outputMedia`. Get title from settings.
- **Checkbox `onChange` signature**: `(value: T | '', checked: boolean)` — the boolean is the **second** arg.
- **Preview media types need casting**: Document previews have `kind: "document"` with `thumbnailUrl`; image previews have `kind: "image"` with `url`. Neither is on the base `Preview` type — cast with `as any`.
- **`outputMedia[].files[].url` is temporary**: Must be downloaded immediately by the backend. It expires shortly after publish.
- **Manifest must match code**: `canva-app.json` intent declarations must exactly match `prepare*()` calls in `index.tsx`. Mismatch causes "Intent registration mismatch" error.
- **Content Publisher only = Share menu only**: Adding `design_editor` intent makes the app also appear as an editor side panel (not wanted).

## Key Files

| File | Role |
|------|------|
| `canva-app/canva-app.json` | Manifest — declares `content_publisher` intent |
| `canva-app/src/intents/content_publisher/index.tsx` | Core intent: PDF config, settings/preview rendering, publish logic |
| `canva-app/src/intents/content_publisher/settings_ui.tsx` | Settings panel: slug, download/print toggles |
| `canva-app/src/intents/content_publisher/types.ts` | `PublishSettings` interface, `parsePublishSettings()` |
| `worker/src/routes/publish.ts` | Downloads PDF from Canva temp URL, stores in R2, creates D1 record |
| `worker/src/pages/viewer.ts` | HTML viewer with PDF.js, tracks views, respects download/print flags |
| `worker/src/pages/stats.ts` | HTML analytics dashboard with view history |
| `worker/src/db/schema.sql` | D1 schema: `documents` + `views` tables |

## Canva App ID

`AAHAAMMv83Q` — set in `canva-app/.env` as `CANVA_APP_ID`.

## Production URL

Worker: `https://send-canva-worker.brickstack.workers.dev`

The `WORKER_BASE_URL` constant in `canva-app/src/intents/content_publisher/index.tsx` points here. For the real send.co integration, this is the only thing that changes — swap the URL to the send.co API.
