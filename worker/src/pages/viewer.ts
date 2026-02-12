import { Hono } from "hono";
import type { Env } from "../index";

export const viewerPage = new Hono<{ Bindings: Env }>();

viewerPage.get("/:slug", async (c) => {
  const slug = c.req.param("slug");

  const doc = await c.env.DB.prepare(
    `SELECT * FROM documents WHERE slug = ?`
  )
    .bind(slug)
    .first<{
      id: string;
      title: string;
      slug: string;
      r2_key: string;
      allow_download: number;
      allow_print: number;
      created_at: string;
    }>();

  if (!doc) {
    return c.html(notFoundHtml(), 404);
  }

  const baseUrl = c.env.BASE_URL || `https://${c.req.header("host")}`;
  const fileUrl = `${baseUrl}/api/file/${doc.id}`;

  return c.html(viewerHtml(doc, fileUrl, baseUrl));
});

function notFoundHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Document not found</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;1,9..40,300&family=Instrument+Serif:ital@0;1&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'DM Sans', sans-serif;
    background: #FAFAF8;
    color: #1a1a1a;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
  }
  .gone {
    text-align: center;
    animation: rise 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .gone h1 {
    font-family: 'Instrument Serif', serif;
    font-weight: 400;
    font-size: 2.4rem;
    letter-spacing: -0.02em;
    margin-bottom: 0.5rem;
  }
  .gone p { color: #888; font-size: 0.95rem; }
  @keyframes rise {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
</head>
<body>
  <div class="gone">
    <h1>This document doesn't exist</h1>
    <p>The link may have expired or been removed.</p>
  </div>
</body>
</html>`;
}

function viewerHtml(
  doc: { id: string; title: string; slug: string; allow_download: number; allow_print: number; created_at: string },
  fileUrl: string,
  baseUrl: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(doc.title)} — Send</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.min.mjs" type="module"></script>
<style>
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --bg: #F6F5F1;
    --surface: #FFFFFF;
    --text: #1A1A18;
    --text-muted: #8A8A82;
    --accent: #E23D28;
    --accent-hover: #C4311F;
    --border: #E8E7E3;
    --shadow: 0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06);
    --radius: 10px;
  }

  html, body {
    height: 100%;
    overflow: hidden;
    font-family: 'DM Sans', system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    -webkit-font-smoothing: antialiased;
  }

  ${!doc.allow_print ? `@media print { body { display: none !important; } }` : ""}

  /* ── Layout ── */
  .shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
    animation: fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── Top Bar ── */
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    height: 56px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    z-index: 10;
  }

  .topbar-left {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .brand-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent);
  }

  .brand-name {
    font-size: 0.85rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .divider {
    width: 1px;
    height: 20px;
    background: var(--border);
    flex-shrink: 0;
  }

  .doc-title {
    font-family: 'Instrument Serif', serif;
    font-size: 1.1rem;
    font-weight: 400;
    letter-spacing: -0.01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .topbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: none;
    border-radius: 8px;
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-ghost {
    background: transparent;
    color: var(--text-muted);
  }
  .btn-ghost:hover {
    background: var(--border);
    color: var(--text);
  }

  .btn-primary {
    background: var(--accent);
    color: #fff;
  }
  .btn-primary:hover { background: var(--accent-hover); }

  .btn svg { width: 15px; height: 15px; }

  /* ── PDF Viewport ── */
  .viewport {
    flex: 1;
    overflow: auto;
    display: flex;
    justify-content: center;
    padding: 32px 24px 80px;
    background:
      radial-gradient(ellipse at 30% 0%, rgba(226,61,40,0.03) 0%, transparent 60%),
      var(--bg);
  }

  .pdf-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .pdf-page {
    background: var(--surface);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    overflow: hidden;
    position: relative;
  }

  .pdf-page canvas {
    display: block;
    max-width: min(100%, 900px);
    height: auto !important;
  }

  /* ── Bottom Controls ── */
  .controls {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 2px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 6px 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    z-index: 20;
    animation: slideUp 0.4s 0.2s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translate(-50%, 12px); }
    to   { opacity: 1; transform: translate(-50%, 0); }
  }

  .ctrl-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    border-radius: 8px;
    cursor: pointer;
    color: var(--text);
    transition: background 0.12s;
  }
  .ctrl-btn:hover { background: var(--border); }
  .ctrl-btn:disabled { opacity: 0.3; cursor: default; }
  .ctrl-btn:disabled:hover { background: transparent; }
  .ctrl-btn svg { width: 18px; height: 18px; }

  .page-indicator {
    padding: 0 12px;
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--text-muted);
    user-select: none;
    white-space: nowrap;
  }

  .ctrl-divider {
    width: 1px;
    height: 20px;
    background: var(--border);
    margin: 0 4px;
  }

  .hidden { display: none !important; }

  /* ── Loading ── */
  .loader {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding-top: 20vh;
    animation: pulse 1.5s ease-in-out infinite;
  }
  .loader-bar {
    width: 48px;
    height: 3px;
    background: var(--border);
    border-radius: 3px;
    overflow: hidden;
    position: relative;
  }
  .loader-bar::after {
    content: '';
    position: absolute;
    left: -50%;
    width: 50%;
    height: 100%;
    background: var(--accent);
    border-radius: 3px;
    animation: slide 1s ease-in-out infinite;
  }
  @keyframes slide {
    0% { left: -50%; }
    100% { left: 100%; }
  }
  .loader-text {
    font-size: 0.82rem;
    color: var(--text-muted);
  }

  /* ── Responsive ── */
  @media (max-width: 640px) {
    .topbar { padding: 0 16px; }
    .viewport { padding: 16px 8px 80px; }
    .doc-title { font-size: 0.95rem; }
    .brand-name { display: none; }
  }
</style>
</head>
<body>

<div class="shell">
  <!-- Top Bar -->
  <header class="topbar">
    <div class="topbar-left">
      <div class="brand">
        <span class="brand-dot"></span>
        <span class="brand-name">Send</span>
      </div>
      <div class="divider"></div>
      <span class="doc-title">${escHtml(doc.title)}</span>
    </div>
    <div class="topbar-right">
      <button class="btn btn-primary" id="copyLinkBtn" title="Copy share link">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"/></svg>
        <span id="copyLinkText">Copy link</span>
      </button>
      ${doc.allow_download ? `
      <button class="btn btn-ghost" id="downloadBtn" title="Download PDF">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
        Download
      </button>
      ` : ""}
    </div>
  </header>

  <!-- PDF Viewport -->
  <div class="viewport" id="viewport">
    <div class="loader" id="loader">
      <div class="loader-bar"></div>
      <span class="loader-text">Loading document...</span>
    </div>
    <div class="pdf-container hidden" id="pdfContainer"></div>
  </div>

  <!-- Bottom Controls -->
  <div class="controls hidden" id="controls">
    <button class="ctrl-btn" id="prevPage" title="Previous page" disabled>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5"/></svg>
    </button>
    <span class="page-indicator" id="pageIndicator">1 / 1</span>
    <button class="ctrl-btn" id="nextPage" title="Next page" disabled>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5"/></svg>
    </button>
    <div class="ctrl-divider"></div>
    <button class="ctrl-btn" id="zoomOut" title="Zoom out">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14"/></svg>
    </button>
    <span class="page-indicator" id="zoomLevel">100%</span>
    <button class="ctrl-btn" id="zoomIn" title="Zoom in">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
    </button>
  </div>
</div>

<script type="module">
  import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.min.mjs';
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.worker.min.mjs';

  const FILE_URL = '${fileUrl}';
  const DOC_ID = '${doc.id}';
  const TRACK_URL = '${baseUrl}/api/track';

  // Track the view
  fetch(TRACK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId: DOC_ID }),
  }).catch(() => {});

  let pdfDoc = null;
  let currentScale = 1.0;

  async function init() {
    try {
      pdfDoc = await pdfjsLib.getDocument(FILE_URL).promise;
      const totalPages = pdfDoc.numPages;

      document.getElementById('loader').classList.add('hidden');
      document.getElementById('pdfContainer').classList.remove('hidden');
      document.getElementById('controls').classList.remove('hidden');

      document.getElementById('pageIndicator').textContent = totalPages + ' page' + (totalPages > 1 ? 's' : '');

      // Render all pages
      for (let i = 1; i <= totalPages; i++) {
        await renderPage(i);
      }

      // Setup controls
      setupZoom();
      if (totalPages > 1) setupPageNav(totalPages);

    } catch (err) {
      document.getElementById('loader').innerHTML =
        '<span class="loader-text" style="color: var(--accent);">Failed to load document</span>';
      console.error(err);
    }
  }

  async function renderPage(num) {
    const page = await pdfDoc.getPage(num);
    const viewport = page.getViewport({ scale: 1.5 * currentScale });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.dataset.pageNum = num;

    const wrapper = document.createElement('div');
    wrapper.className = 'pdf-page';
    wrapper.dataset.pageNum = num;
    wrapper.appendChild(canvas);

    document.getElementById('pdfContainer').appendChild(wrapper);

    await page.render({ canvasContext: ctx, viewport }).promise;
  }

  function setupZoom() {
    const zoomIn = document.getElementById('zoomIn');
    const zoomOut = document.getElementById('zoomOut');
    const zoomLevel = document.getElementById('zoomLevel');

    zoomIn.addEventListener('click', () => {
      if (currentScale < 2.5) {
        currentScale = Math.min(currentScale + 0.25, 2.5);
        rerenderAll();
        zoomLevel.textContent = Math.round(currentScale * 100) + '%';
      }
    });

    zoomOut.addEventListener('click', () => {
      if (currentScale > 0.5) {
        currentScale = Math.max(currentScale - 0.25, 0.5);
        rerenderAll();
        zoomLevel.textContent = Math.round(currentScale * 100) + '%';
      }
    });
  }

  function setupPageNav(totalPages) {
    const prev = document.getElementById('prevPage');
    const next = document.getElementById('nextPage');
    prev.disabled = false;
    next.disabled = false;

    prev.addEventListener('click', () => {
      const viewport = document.getElementById('viewport');
      const pages = document.querySelectorAll('.pdf-page');
      for (let i = pages.length - 1; i >= 0; i--) {
        if (pages[i].getBoundingClientRect().top < viewport.getBoundingClientRect().top - 5) {
          pages[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
          break;
        }
      }
    });

    next.addEventListener('click', () => {
      const viewport = document.getElementById('viewport');
      const pages = document.querySelectorAll('.pdf-page');
      for (const page of pages) {
        if (page.getBoundingClientRect().top > viewport.getBoundingClientRect().top + 5) {
          page.scrollIntoView({ behavior: 'smooth', block: 'start' });
          break;
        }
      }
    });
  }

  async function rerenderAll() {
    const container = document.getElementById('pdfContainer');
    container.innerHTML = '';
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      await renderPage(i);
    }
  }

  // Copy link button
  const COPIED_OPACITY = '0.7';
  const FEEDBACK_DURATION_MS = 2000;
  
  document.getElementById('copyLinkBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('copyLinkBtn');
    const text = document.getElementById('copyLinkText');
    
    if (!btn || !text) return;
    
    const currentUrl = window.location.href;
    
    try {
      await navigator.clipboard.writeText(currentUrl);
      text.textContent = 'Copied!';
      btn.style.opacity = COPIED_OPACITY;
      
      setTimeout(() => {
        text.textContent = 'Copy link';
        btn.style.opacity = '1';
      }, FEEDBACK_DURATION_MS);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  });

  ${doc.allow_download ? `
  document.getElementById('downloadBtn')?.addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = FILE_URL;
    a.download = '${escHtml(doc.title)}.pdf';
    a.click();
  });
  ` : ""}

  init();
</script>

</body>
</html>`;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
