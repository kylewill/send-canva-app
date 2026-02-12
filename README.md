# Send Canva App — Integration Guide

A POC Canva Content Publisher app that lets users create tracked document links from Canva's **Share menu**. This repo validates the concept and documents everything needed to build the real [send.co](https://send.co) integration.

**Design in Canva → Share → Send → Get a tracked link → See who viewed it**

---

## How to Integrate with send.co

1. Open this repo with Claude Code
2. Tell it to review `CLAUDE.md` in this repo and the `CLAUDE.md` (or equivalent) in the send codebase
3. Ask it to make a plan to integrate the Canva app with send

### What stays the same

The Canva app flow is unchanged — settings UI, preview, publish button, PDF export. Everything up to generating the link works exactly as the POC.

### What changes

Instead of POSTing the PDF to the Cloudflare Worker, the Canva app POSTs it to send's API to get a real send URL. The one file that changes is `canva-app/src/intents/content_publisher/index.tsx` — swap the `WORKER_BASE_URL` and adjust the request/response shape to match send's API.

### Auth strategy

Two options (not mutually exclusive):

- **Option A: OAuth in Canva (optional)** — Use `auth.getCanvaUserToken()` from `@canva/user` to silently identify users. Send the JWT alongside the publish request. No login screen needed. See [Canva User Identity](#canva-user-identity-frictionless-auth) below.
- **Option B: Auth when user opens the link** — The `externalUrl` in the publish response points to the send stats page. Handle sign-up/sign-in there. The Canva `userId` from the publish request can pre-associate the document so it's waiting when the user creates an account.

Either way, the first publish should be **instant** — no sign-up gate.

### Post-publish UX

Canva controls the success dialog after publish. You cannot customize it. The only lever is `externalUrl` which Canva renders as a clickable button. The UX is:

```
Publish → Canva success dialog → user clicks button → send stats page → copy link
```

Build copy-link and share UX into the send stats/dashboard page, not inside Canva.

---

## Table of Contents

- [What This POC Proves](#what-this-poc-proves)
- [Architecture Overview](#architecture-overview)
- [Canva Content Publisher — How It Works](#canva-content-publisher--how-it-works)
- [Key Affordances for send.co](#key-affordances-for-sendco)
- [UX Flow: Fast First Document](#ux-flow-fast-first-document)
- [Integrating with the Real send.co Backend](#integrating-with-the-real-sendco-backend)
- [Canva SDK Reference & Gotchas](#canva-sdk-reference--gotchas)
- [Documentation & Resources to Read](#documentation--resources-to-read)
- [POC Project Structure](#poc-project-structure)
- [Running the POC](#running-the-poc)
- [POC API Reference](#poc-api-reference)

---

## What This POC Proves

1. A Canva app **can** appear exclusively in the Share menu (Content Publisher intent, no Design Editor intent)
2. Canva exports designs as **PDF** (letter size) and provides a temporary download URL
3. The app can collect user settings (slug, permissions) before publish via a settings panel
4. The app can POST the exported PDF to an external API and return a tracking URL
5. The publish flow is: settings → preview → one-click publish → done (link returned to Canva)
6. The viewer/stats pages are served externally, not inside Canva

---

## Architecture Overview

```
CANVA EDITOR                        SEND.CO
┌──────────────────┐               ┌──────────────────────────────┐
│ Share Menu        │               │                              │
│  └─ Send App      │               │  POST /api/documents         │
│     ┌────────────┐│   publish     │   - receive PDF blob         │
│     │ Settings UI ││──────────▶   │   - store file               │
│     │ Preview UI  ││              │   - create tracking record   │
│     │ Publish btn ││              │   - return { viewUrl, ... }  │
│     └────────────┘│               │                              │
└──────────────────┘               │  GET /view/:slug              │
                                    │   - PDF viewer for recipients │
  RECIPIENT                         │   - auto-tracks views         │
┌──────────────────┐               │                              │
│ /view/:slug       │◀──────────   │  GET /stats/:slug             │
│  (PDF viewer)     │──track──▶    │   - analytics for sender      │
└──────────────────┘               │                              │
                                    │  Auth: OAuth / magic link     │
  SENDER                           │   - deferred sign-in          │
┌──────────────────┐               │   - claim docs post-signup    │
│ /stats/:slug      │◀──────────   │                              │
│  (analytics)      │               └──────────────────────────────┘
└──────────────────┘
```

In the POC, the "SEND.CO" box is a Cloudflare Worker. For the real integration, replace the Worker API calls with send.co API calls.

---

## Canva Content Publisher — How It Works

The Content Publisher intent is how third-party apps appear in Canva's **Share menu**. It follows a strict lifecycle:

### Lifecycle

```
1. getPublishConfiguration()    → Tell Canva what file format you want (PDF, PNG, etc.)
2. renderSettingsUi()           → Show your settings panel (slug, permissions, etc.)
3. renderPreviewUi()            → Show a preview of what will be published
4. publishContent(request)      → Canva calls this with the exported file URL — you POST it to your API
```

### What Canva Gives You at Publish Time

The `PublishContentRequest` object contains:

```typescript
{
  publishRef: string;          // Your settings JSON (from updatePublishSettings)
  outputType: OutputType;      // The output type you configured
  outputMedia: [{
    mediaSlotId: "media",
    files: [{
      url: string;             // ⚡ TEMPORARY download URL for the exported file
      mimeType: string;        // "application/pdf"
    }]
  }]
}
```

**Critical**: `request.outputMedia[].files[].url` is a **temporary URL**. Your backend must download it immediately during the publish call. It expires shortly after.

**Note**: There is no `request.title` field. The design title is not available in `publishContent`. If you need a title, collect it in settings or derive it from the slug.

### What You Return

```typescript
// Success — Canva shows a "Published" confirmation with a button linking to externalUrl
{ status: "completed", externalId: "your-doc-id", externalUrl: "https://send.co/stats/slug" }

// Failure options (only these two are valid):
{ status: "app_error", message: "Human-readable error" }
{ status: "remote_request_failed" }
```

**Gotcha**: The error status is `"app_error"` (not `"error"`), and it requires a `message` field.

### Post-Publish UX (Canva-Controlled)

After `publishContent` returns `"completed"`, Canva shows its own success dialog. **You cannot customize this dialog** — no custom buttons, text, or layout. Your only lever is `externalUrl`, which Canva renders as a clickable button.

There is a `postPublishAction: { type: "redirect", url: "..." }` field in the SDK types, but it is **not implemented yet** — no official docs, no working examples, and Canva's security model (iframe sandbox, `window.open` blocked) may prevent automatic redirects entirely.

**The actual UX flow is:**

```
1. User clicks Publish → Canva exports PDF → app POSTs to backend
2. Canva shows success dialog with button linking to externalUrl (stats page)
3. User clicks the button → opens stats page in new tab
4. Stats page has "Copy link" button for the /view/:slug URL
5. User copies and shares the tracked link with recipients
```

Build your post-publish experience (copy link, share buttons, etc.) into the destination page, not inside Canva.

---

## Key Affordances for send.co

### What Canva Provides

| Affordance | Detail |
|---|---|
| **PDF export** | `pdf_standard` format, `letter` size. Canva renders the design and gives you a download URL. |
| **Settings panel** | Full React UI inside Canva. Can use Canva's App UI Kit components (TextInput, Checkbox, Select, etc.) or custom UI. |
| **Preview panel** | Shows a real-time preview that updates as settings change. Good for showing the final link URL. |
| **Publish ref** | Arbitrary string (we use JSON) passed from settings UI → publish function. This is how settings survive between steps. |
| **Post-publish link** | `externalUrl` in the response — Canva shows as a clickable button in the success dialog. No auto-redirect, no custom UI. Build your post-publish UX (copy link, share) into the destination page. |
| **App UI Kit** | Canva's component library: buttons, inputs, checkboxes, rows, text, image cards, etc. Matches Canva's design language. |
| **Design thumbnail** | Available in preview UI via `previewMedia`. Document previews have `kind: "document"` with `status: "thumbnail"`. |

### What Canva Does NOT Provide

| Limitation | Workaround |
|---|---|
| **No user identity in `publishContent`** | The publish request itself doesn't include user info. But you CAN call `auth.getCanvaUserToken()` from `@canva/user` to get a JWT with `userId` + `brandId` before publishing. See [Canva User Identity](#canva-user-identity-frictionless-auth) below. |
| **No design title** | Not available in `publishContent`. Collect via settings UI or generate from slug. |
| **No re-publish/update** | Each publish creates a new document. No built-in "update existing" flow. Could implement via slug collision handling. |
| **No webhook on design change** | Can't auto-update published docs when the Canva design changes. |
| **No persistent storage** | The Canva app itself has no server-side storage. All state lives on your backend. |

### Export Formats Available

```typescript
// PDF (what we use)
accepts: { document: { format: "pdf_standard", size: "letter" } }

// Other options:
accepts: { image: { format: "png" } }           // Single image
accepts: { image: { format: "jpg" } }           // Single image
accepts: { video: { format: "mp4" } }           // Video designs
// Multiple images (one per page):
accepts: { image: { format: "png" } }           // with fileCount: { range: { min: 1, max: 100 } }
```

---

## UX Flow: Fast First Document

The goal: users should create their first tracked link **as fast as possible**, with sign-in deferred until they need it.

### Proposed Flow

```
FIRST USE (no auth required):
1. User opens Share → Send
2. Settings UI shows: slug input, download/print toggles
3. User clicks Publish
4. Canva exports PDF → app POSTs to send.co API (anonymous)
5. send.co creates document, returns viewUrl + statsUrl
6. Canva shows "Published!" with link to statsUrl
7. User shares viewUrl with recipients

CLAIMING THE DOCUMENT (deferred auth):
8. User visits statsUrl → sees stats page
9. Stats page has "Sign in to manage this document" prompt
10. User signs in (OAuth / magic link / email)
11. Document is claimed to their account
12. Future publishes from same Canva account auto-associate

RETURNING USER:
- If send.co cookie/token exists, publish is fully authenticated
- Stats page shows all their documents, not just this one
```

### Canva User Identity (Frictionless Auth)

Canva provides **frictionless authentication** via `auth.getCanvaUserToken()` from the `@canva/user` package. This is the recommended approach — it gives you a stable user identity **without showing any login screen**.

Docs: https://www.canva.dev/docs/apps/authenticating-users/frictionless/

```typescript
import { auth } from "@canva/user";

// Get a JWT identifying the current Canva user — no login prompt
const token = await auth.getCanvaUserToken();
// token is a JWT string: eyJhbGciOiJSUzI1NiIs...
```

The JWT, once verified on your backend, contains:

| Field | Description |
|---|---|
| `userId` | Stable unique ID for the Canva user |
| `brandId` | The user's Canva team/brand ID |
| `aud` | Your app ID (for verification) |

**Rate limit**: 10 requests per 10 seconds.

#### Backend Verification

Your backend verifies the JWT using Canva's JWKS endpoint:

```
https://api.canva.com/rest/v1/apps/{YOUR_APP_ID}/jwks
```

With Express.js, use `@canva/app-middleware`:

```typescript
import { user } from "@canva/app-middleware/express";

app.use("/api", user.verifyToken({ appId: process.env.CANVA_APP_ID }));

app.post("/api/documents", (req, res) => {
  const { userId, brandId } = req.canva.user;
  // userId is a stable identifier — use it to associate documents
});
```

For non-Node.js backends, manually verify the JWT:
1. Fetch the JWKS from the endpoint above
2. Extract `kid` from the JWT header
3. Find the matching key in JWKS
4. Verify the JWT signature and decode the payload

Full verification guide: https://www.canva.dev/docs/apps/verifying-jwts/

#### Recommended Strategy for send.co

Use frictionless auth to silently identify users, but don't require a send.co account to publish:

```
EVERY PUBLISH (silent, no UI):
1. Call auth.getCanvaUserToken() → get JWT
2. Send JWT alongside the publish request to send.co
3. send.co verifies JWT, extracts userId + brandId
4. Associates document with this Canva identity (no send.co account needed yet)
5. All documents from same userId are grouped together

FIRST TIME ON STATS PAGE:
6. User visits statsUrl → sees their document stats
7. Page shows all documents from their Canva identity
8. Prompt: "Create a send.co account to unlock email notifications, custom domains, etc."
9. User signs up → send.co account is linked to their Canva userId
10. All previous documents are already associated

RETURNING AUTHENTICATED USER:
- Token is auto-sent on every publish
- Documents auto-associate
- Stats page shows full dashboard with all their documents
```

This means:
- **First publish takes seconds** — no sign-up, no login
- **Canva `userId` acts as a pre-account identity** — documents accumulate
- **send.co account creation is a value-add**, not a gate
- **Webhook for uninstall**: Canva notifies you when a user uninstalls your app (configure in Developer Portal) — clean up data if needed

### Settings UI Considerations for send.co

The POC settings panel collects: `slug`, `allowDownload`, `allowPrint`. For the real integration, consider adding:

- **Document title** (since Canva doesn't provide it)
- **Passcode protection** (optional passcode to view)
- **Expiration** (auto-expire after N days)
- **Notification email** (get notified on views — ties into auth)
- **Workspace/folder** selector (for returning users with accounts)

---

## Integrating with the Real send.co Backend

### What to Replace

The POC Worker handles everything. For send.co, the Canva app only needs to change **one file**: `canva-app/src/intents/content_publisher/index.tsx`.

```typescript
// POC: Posts to Cloudflare Worker
const WORKER_BASE_URL = "https://send-canva-worker.brickstack.workers.dev";
const response = await fetch(`${WORKER_BASE_URL}/api/publish`, { ... });

// REAL: Post to send.co API
const SEND_API_URL = "https://api.send.co";
const response = await fetch(`${SEND_API_URL}/v1/documents`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${userToken}`,  // if authenticated
  },
  body: JSON.stringify({
    fileUrl: mediaFile.url,    // Canva's temp URL — send.co must download immediately
    title: settings.title,
    slug: settings.slug,
    allowDownload: settings.allowDownload,
    allowPrint: settings.allowPrint,
    source: "canva",           // track that this came from Canva integration
  }),
});
```

### What send.co API Needs to Support

| Endpoint | Purpose | Notes |
|---|---|---|
| `POST /v1/documents` | Create a tracked document | Must download from `fileUrl` immediately (temp URL). Return `{ id, slug, viewUrl, statsUrl }`. |
| `GET /view/:slug` | Public viewer page | Render PDF, track views. Already exists in send.co? |
| `GET /stats/:slug` | Analytics page | View count, unique viewers, timeline. Already exists in send.co? |
| `POST /v1/documents/:id/claim` | Claim anonymous doc | Associate with user account post-sign-in. |

### Critical: Downloading the Canva Export

The `fileUrl` from Canva is **temporary**. Your backend must:

```
1. Receive the fileUrl in the POST body
2. Immediately fetch(fileUrl) to download the PDF bytes
3. Store the bytes in your file storage (S3, R2, GCS, etc.)
4. Return the response to the Canva app
```

Do NOT store the `fileUrl` for later — it will expire. The POC's `publish.ts` shows exactly how this works.

---

## Canva SDK Reference & Gotchas

### Packages Used

```json
{
  "@canva/intents": "^2.2.0",        // Content Publisher intent types + registration
  "@canva/app-ui-kit": "^5.5.0",     // UI components (TextInput, Checkbox, Rows, etc.)
  "@canva/app-i18n-kit": "^1.2.0",   // Required wrapper for i18n
  "@canva/app-hooks": "^0.0.0-beta.4", // React hooks for Canva APIs
  "@canva/user": "^2.1.2"            // auth.getCanvaUserToken() for frictionless user identity
}
```

### Type Gotchas (will save you hours)

1. **Error responses** — Only `"app_error"` (with `message: string`) or `"remote_request_failed"` are valid. Not `"error"`.

2. **No `title` on `PublishContentRequest`** — Only `publishRef`, `outputType`, `outputMedia`. Get title from your settings.

3. **Checkbox `onChange`** — Signature is `(value: T | '', checked: boolean)`. The boolean is the **second** argument:
   ```tsx
   <Checkbox onChange={(_value, checked) => { /* checked is the boolean */ }} />
   ```

4. **Preview media types** — Document previews have `kind: "document"` with `status: "thumbnail"` and a `thumbnailUrl`. Image previews have `kind: "image"` with `status: "ready"` and a `url`. Neither is on the base `Preview` type — you need to cast:
   ```tsx
   const thumbnailUrl = (preview as any)?.thumbnailUrl || (preview as any)?.url;
   ```

5. **`publishRef` is a string** — We serialize settings as JSON into `publishRef` via `updatePublishSettings()`. Canva passes it back as `request.publishRef` in `publishContent()`.

6. **Intent registration** — Only register intents you actually use. `content_publisher` alone is sufficient for a Share menu app. Adding `design_editor` makes it also appear as a side panel in the editor (usually not wanted for a publisher).

7. **Manifest (`canva-app.json`)** — Must match registered intents exactly. If the manifest declares `design_editor: { enrolled: true }` but the code doesn't call `prepareDesignEditor()`, you get "Intent registration mismatch".

### Content Publisher Intent — Full Type

```typescript
interface ContentPublisherIntent {
  renderSettingsUi: (request: RenderSettingsUiRequest) => void;
  renderPreviewUi: (request: RenderPreviewUiRequest) => void;
  getPublishConfiguration: () => Promise<GetPublishConfigurationResponse>;
  publishContent: (request: PublishContentRequest) => Promise<PublishContentResponse>;
}
```

### UI Kit Components We Used

| Component | Use |
|---|---|
| `TextInput` | Slug input |
| `Checkbox` | Allow download, allow print toggles |
| `FormField` | Label + description wrapper for inputs |
| `Rows` | Vertical stack layout with spacing |
| `Text` | Typography (size: `"small"`, `"xsmall"`, variant: `"bold"`, tone: `"tertiary"`) |
| `Box` | Flex container |
| `ImageCard` | Document thumbnail preview |
| `Placeholder` / `TextPlaceholder` | Loading states |

Full component list: [Canva App UI Kit Storybook](https://www.canva.dev/docs/apps/app-ui-kit/)

---

## Documentation & Resources to Read

### Essential (read these first)

| Resource | URL | Why |
|---|---|---|
| **Content Publisher guide** | https://www.canva.dev/docs/apps/content-publisher/ | Core concept, lifecycle, code examples |
| **Content Publisher API reference** | https://www.canva.dev/docs/apps/api/intents-content/ | Type definitions for all request/response objects |
| **App UI Kit docs** | https://www.canva.dev/docs/apps/app-ui-kit/ | Available components, props, usage patterns |
| **Canva CLI reference** | https://www.canva.dev/docs/apps/cli/ | `canva apps create`, `canva apps deploy`, dev server |

### Useful Reference

| Resource | URL | Why |
|---|---|---|
| **App manifest schema** | https://www.canva.dev/docs/apps/manifest/ | `canva-app.json` structure, intent declarations |
| **Permissions reference** | https://www.canva.dev/docs/apps/permissions/ | Available permissions (`canva:design:content:read`, etc.) |
| **Developer Portal** | https://www.canva.com/developers/apps | Manage apps, set dev URL, add collaborators |
| **Canva Connect APIs** | https://www.canva.dev/docs/connect/ | Server-to-server APIs (if needed for deeper integration) |

### Authentication (you will need these)

| Resource | URL | Why |
|---|---|---|
| **Authenticating users overview** | https://www.canva.dev/docs/apps/authenticating-users/ | Three auth strategies: frictionless, OAuth, manual |
| **Frictionless auth guide** | https://www.canva.dev/docs/apps/authenticating-users/frictionless/ | The recommended approach — `getCanvaUserToken()` flow |
| **`auth.getCanvaUserToken` API** | https://www.canva.dev/docs/apps/api/latest/user-auth-get-canva-user-token/ | Method reference: returns JWT with `userId` + `brandId` |
| **JWT verification** | https://www.canva.dev/docs/apps/verifying-jwts/ | How to verify the token on your backend (JWKS endpoint) |
| **`@canva/app-middleware`** | (npm package) | Express middleware for automatic JWT verification |
| **`@canva/user` package** | https://www.canva.dev/docs/apps/api/latest/user/ | Full `@canva/user` API reference |

### Interpreting the Docs

- The docs show examples for **Design Editor** apps (side panel). Content Publisher is different — it uses `prepareContentPublisher()` not `prepareDesignEditor()`, and the lifecycle is settings → preview → publish (not a persistent side panel).
- Many code samples import from `"@canva/intents/content"` — this is the right import path for Content Publisher types.
- The "preview" in Content Publisher is NOT a live preview of the Canva design. It's YOUR preview component showing what the published result will look like.
- `publishRef` is the main data-passing mechanism. There's no shared state between settings UI and publish function — everything goes through `publishRef`.

---

## POC Project Structure

```
send-canva-app/
├── canva-app/                          # Canva app (React + TypeScript)
│   ├── src/
│   │   ├── index.tsx                   # Entry — registers Content Publisher intent
│   │   └── intents/content_publisher/
│   │       ├── index.tsx               # Intent config: PDF export, publish to Workers API
│   │       ├── settings_ui.tsx         # Settings panel: slug, download, print toggles
│   │       ├── preview_ui.tsx          # Preview wrapper (listens to registerOnPreviewChange)
│   │       ├── post_preview.tsx        # Document preview: thumbnail + link preview + settings summary
│   │       └── types.ts               # PublishSettings type + parsePublishSettings helper
│   ├── canva-app.json                  # Manifest: content_publisher intent only
│   └── .env                            # CANVA_APP_ID=AAHAAMMv83Q
│
├── worker/                             # Cloudflare Workers backend (Hono) — POC only
│   ├── src/
│   │   ├── index.ts                    # Hono app entry, route mounting, CORS
│   │   ├── routes/
│   │   │   ├── publish.ts             # POST /api/publish — download PDF from temp URL, store in R2, create D1 record
│   │   │   ├── track.ts              # POST /api/track — record view event (IP, UA, referer)
│   │   │   └── file.ts               # GET /api/file/:id — serve PDF from R2
│   │   ├── pages/
│   │   │   ├── viewer.ts             # GET /view/:slug — PDF viewer (PDF.js, send.co-style design)
│   │   │   └── stats.ts              # GET /stats/:slug — analytics page (views, unique IPs, timeline)
│   │   └── db/
│   │       └── schema.sql             # D1 schema: documents + views tables
│   └── wrangler.toml                   # Workers config: R2, D1 bindings
│
├── PLAN.md                             # Architecture decisions and learnings
└── README.md                           # This file
```

---

## Running the POC

### Prerequisites

- Node.js v20.10+, npm v10+
- [Canva CLI](https://www.npmjs.com/package/@canva/cli): `npm install -g @canva/cli@latest`

### Canva App (local dev)

```bash
cd canva-app
npm install
npm start
# App runs at http://localhost:8080
```

In [Canva Developer Portal](https://www.canva.com/developers/apps):
1. Open your app → **Code upload** → **Development URL** → `http://localhost:8080`
2. Click **Preview** to open Canva editor
3. Open **Share menu** → find the Send app

**Sharing with others**: Use `cloudflared tunnel --url http://localhost:8080` to get a public URL, set it as the Development URL, and add collaborators in the portal.

### Worker Backend

Already deployed at `https://send-canva-worker.brickstack.workers.dev`.

For local dev:
```bash
cd worker
npm install
npx wrangler d1 execute send-canva-db --local --file=src/db/schema.sql
npx wrangler dev --port 8788
```

### Test Without Canva

```bash
# Publish a test document
curl -X POST https://send-canva-worker.brickstack.workers.dev/api/publish \
  -H "Content-Type: application/json" \
  -d '{"fileUrl": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", "title": "Test Proposal", "slug": "test-proposal"}'

# View it
open https://send-canva-worker.brickstack.workers.dev/view/test-proposal

# Check stats
open https://send-canva-worker.brickstack.workers.dev/stats/test-proposal
```

---

## POC API Reference

These endpoints are on the POC Worker (`send-canva-worker.brickstack.workers.dev`). The real integration replaces these with send.co API calls.

### POST /api/publish

Creates a tracked document. Downloads the PDF from the temporary URL and stores it.

```json
// Request
{
  "fileUrl": "https://...",        // Canva temp URL — must be downloaded immediately
  "title": "My Proposal",
  "slug": "my-proposal",          // Optional, auto-generated if omitted
  "allowDownload": true,
  "allowPrint": false
}

// Response
{
  "id": "BuSBH5ViGQH1",
  "slug": "my-proposal",
  "viewUrl": "https://send-canva-worker.brickstack.workers.dev/view/my-proposal",
  "statsUrl": "https://send-canva-worker.brickstack.workers.dev/stats/my-proposal"
}
```

### POST /api/track

Records a view event. Called automatically by the viewer page on load.

```json
{ "documentId": "BuSBH5ViGQH1" }
```

### GET /api/file/:id

Serves the PDF from R2. Sets `Content-Disposition: inline` (or `attachment` if download allowed).

### GET /view/:slug

Public viewer page. PDF.js-based renderer with send.co-style UI (DM Sans + Instrument Serif fonts, `#E23D28` accent, `#F6F5F1` background). Tracks views on load. Conditionally shows download button and blocks printing via CSS.

### GET /stats/:slug

Analytics dashboard. Shows total views, unique viewers (by IP), last viewed time, and a table of all view events with masked IPs, browser detection, and referrer.

---

## Database Schema (POC)

```sql
CREATE TABLE documents (
  id TEXT PRIMARY KEY,              -- nanoid(12)
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  r2_key TEXT NOT NULL,             -- "documents/{id}.pdf"
  allow_download INTEGER DEFAULT 0,
  allow_print INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE views (
  id TEXT PRIMARY KEY,              -- nanoid(12)
  document_id TEXT NOT NULL,
  viewed_at TEXT DEFAULT (datetime('now')),
  ip_address TEXT,                  -- from cf-connecting-ip header
  user_agent TEXT,
  referer TEXT,
  FOREIGN KEY (document_id) REFERENCES documents(id)
);
```

---

## Cloudflare Resources (POC)

| Resource | Name | ID |
|---|---|---|
| Worker | `send-canva-worker` | — |
| R2 Bucket | `send-canva-files` | — |
| D1 Database | `send-canva-db` | `26ec631f-f1ad-4799-a646-1ddee5682eb5` |
| Canva App | Send | `AAHAAMMv83Q` |
