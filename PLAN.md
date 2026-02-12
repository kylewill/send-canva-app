# Send Canva App - POC Plan

## Context

We're building a Canva Content Publisher app that lets users send and track Canva designs through a send.co-style experience. The app appears in Canva's **Share menu**, letting users export their design as a PDF, configure tracking/permission settings, and get a shareable tracked link. Recipients view the document on a hosted viewer page, and all views are tracked. Users visit `/stats/:slug` to see view analytics on their link.

This is a POC to validate the concept. After it works, we'll integrate with the real send.co platform.

## Architecture

```
CANVA EDITOR                    CLOUDFLARE
┌─────────────────┐            ┌──────────────────────────┐
│ Share Menu       │            │  Workers API             │
│  └─ Send App     │───POST───▶│   /api/publish           │
│    - Settings UI │            │                          │
│    - Preview UI  │            ├──────────────────────────┤
│    - Publish     │            │  R2 Bucket               │
└─────────────────┘            │   (PDF storage)          │
                               ├──────────────────────────┤
  RECIPIENT                    │  D1 Database             │
┌─────────────────┐            │   documents, views       │
│ /view/:slug      │◀──GET─────│                          │
│  (PDF viewer)    │───track──▶│                          │
└─────────────────┘            │                          │
                               │                          │
  SENDER                       │                          │
┌─────────────────┐            │                          │
│ /stats/:slug     │◀──GET─────│   view count, times,     │
│  (analytics)     │           │   user agents            │
└─────────────────┘            └──────────────────────────┘
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Canva App | React + TypeScript, Canva App UI Kit, `@canva/intents/content` |
| Backend API | Cloudflare Workers (Hono framework) |
| File Storage | Cloudflare R2 |
| Database | Cloudflare D1 (SQLite) |
| Viewer Page | Served from Workers (HTML + PDF.js from CDN) |
| Stats Page | Served from Workers (HTML with view analytics) |
| Deployment | Canva CLI (`canva apps deploy`) + Wrangler (`wrangler deploy`) |

## Routes

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/publish` | Receive exported PDF, store in R2, create tracking link |
| POST | `/api/track` | Record a view event |
| GET | `/api/file/:id` | Serve PDF from R2 |
| GET | `/view/:slug` | Viewer page (public, for recipients) |
| GET | `/stats/:slug` | Stats page (for sender, shows view analytics) |
