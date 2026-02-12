import { Hono } from "hono";
import type { Env } from "../index";

export const statsPage = new Hono<{ Bindings: Env }>();

statsPage.get("/:slug", async (c) => {
  const slug = c.req.param("slug");

  const doc = await c.env.DB.prepare(`SELECT * FROM documents WHERE slug = ?`)
    .bind(slug)
    .first<{
      id: string;
      title: string;
      slug: string;
      allow_download: number;
      allow_print: number;
      created_at: string;
    }>();

  if (!doc) {
    return c.html(notFoundHtml(), 404);
  }

  const viewsResult = await c.env.DB.prepare(
    `SELECT * FROM views WHERE document_id = ? ORDER BY viewed_at DESC LIMIT 200`
  )
    .bind(doc.id)
    .all<{
      id: string;
      document_id: string;
      viewed_at: string;
      ip_address: string;
      user_agent: string;
      referer: string;
    }>();

  const views = viewsResult.results || [];

  const totalViews = views.length;
  const uniqueIps = new Set(views.map((v) => v.ip_address)).size;

  const baseUrl = c.env.BASE_URL || `https://${c.req.header("host")}`;
  const viewUrl = `${baseUrl}/view/${doc.slug}`;

  return c.html(statsHtml(doc, views, totalViews, uniqueIps, viewUrl));
});

function notFoundHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Not found</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;500&family=Instrument+Serif:ital@0;1&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'DM Sans', sans-serif; background: #FAFAF8; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  h1 { font-family: 'Instrument Serif', serif; font-weight: 400; font-size: 2rem; }
  p { color: #888; margin-top: 0.5rem; font-size: 0.9rem; }
</style>
</head>
<body>
  <div style="text-align:center"><h1>Document not found</h1><p>Check the link and try again.</p></div>
</body>
</html>`;
}

function statsHtml(
  doc: { id: string; title: string; slug: string; created_at: string; allow_download: number; allow_print: number },
  views: Array<{ viewed_at: string; ip_address: string; user_agent: string; referer: string }>,
  totalViews: number,
  uniqueIps: number,
  viewUrl: string,
): string {
  const createdDate = new Date(doc.created_at + "Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const viewRows = views
    .map((v) => {
      const time = new Date(v.viewed_at + "Z");
      const timeStr = time.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        + " at "
        + time.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      const maskedIp = maskIp(v.ip_address);
      const browser = parseBrowser(v.user_agent);
      const ref = v.referer ? new URL(v.referer).hostname : "Direct";
      return `<tr>
        <td>${escHtml(timeStr)}</td>
        <td><code>${escHtml(maskedIp)}</code></td>
        <td>${escHtml(browser)}</td>
        <td>${escHtml(ref)}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Stats — ${escHtml(doc.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&family=Instrument+Serif:ital@0;1&family=DM+Mono:wght@400&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --bg: #F6F5F1;
    --surface: #FFFFFF;
    --text: #1A1A18;
    --text-muted: #8A8A82;
    --text-dim: #B5B5AD;
    --accent: #E23D28;
    --accent-soft: #FEF0EE;
    --border: #E8E7E3;
    --shadow: 0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06);
    --radius: 12px;
  }

  html {
    font-family: 'DM Sans', system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    -webkit-font-smoothing: antialiased;
  }

  body {
    min-height: 100vh;
    padding: 0;
  }

  /* ── Top Bar ── */
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 32px;
    height: 56px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .topbar-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 6px;
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
  }

  .back-link {
    font-size: 0.82rem;
    color: var(--text-muted);
    text-decoration: none;
    transition: color 0.12s;
  }
  .back-link:hover { color: var(--text); }

  /* ── Content ── */
  .content {
    max-width: 880px;
    margin: 0 auto;
    padding: 40px 32px 80px;
    animation: fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── Header ── */
  .header {
    margin-bottom: 40px;
  }

  .header h1 {
    font-family: 'Instrument Serif', serif;
    font-weight: 400;
    font-size: 2.2rem;
    letter-spacing: -0.02em;
    line-height: 1.2;
    margin-bottom: 8px;
  }

  .header-meta {
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 0.82rem;
    color: var(--text-muted);
  }

  .header-meta span { display: flex; align-items: center; gap: 4px; }

  .link-row {
    margin-top: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .link-box {
    flex: 1;
    padding: 10px 14px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-family: 'DM Mono', monospace;
    font-size: 0.82rem;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 18px;
    border: none;
    border-radius: 8px;
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .btn-primary {
    background: var(--accent);
    color: #fff;
  }
  .btn-primary:hover { background: #C4311F; }

  .btn svg { width: 14px; height: 14px; }

  .copied-toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translate(-50%, 20px);
    background: var(--text);
    color: var(--bg);
    padding: 10px 20px;
    border-radius: 10px;
    font-size: 0.82rem;
    font-weight: 500;
    opacity: 0;
    pointer-events: none;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    z-index: 100;
  }
  .copied-toast.show {
    opacity: 1;
    transform: translate(-50%, 0);
  }

  /* ── Stat Cards ── */
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 40px;
  }

  .stat-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 24px;
    animation: fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .stat-card:nth-child(2) { animation-delay: 0.05s; }
  .stat-card:nth-child(3) { animation-delay: 0.1s; }

  .stat-card .label {
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin-bottom: 8px;
  }

  .stat-card .value {
    font-family: 'Instrument Serif', serif;
    font-size: 2.6rem;
    font-weight: 400;
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .stat-card .sub {
    font-size: 0.78rem;
    color: var(--text-dim);
    margin-top: 6px;
  }

  /* ── Table ── */
  .table-section {
    animation: fadeUp 0.5s 0.15s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .table-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .table-header h2 {
    font-size: 0.95rem;
    font-weight: 600;
  }

  .table-header .count {
    font-size: 0.78rem;
    color: var(--text-muted);
  }

  .table-wrap {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th {
    text-align: left;
    padding: 12px 20px;
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    background: var(--bg);
    border-bottom: 1px solid var(--border);
  }

  td {
    padding: 14px 20px;
    font-size: 0.84rem;
    border-bottom: 1px solid var(--border);
    color: var(--text);
  }

  tr:last-child td { border-bottom: none; }

  tr:hover td { background: #FAFAF8; }

  td code {
    font-family: 'DM Mono', monospace;
    font-size: 0.78rem;
    background: var(--bg);
    padding: 2px 8px;
    border-radius: 4px;
    color: var(--text-muted);
  }

  .empty {
    padding: 48px 20px;
    text-align: center;
    color: var(--text-dim);
    font-size: 0.88rem;
  }

  .empty-icon {
    width: 48px;
    height: 48px;
    background: var(--bg);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 12px;
  }

  .empty-icon svg {
    width: 22px;
    height: 22px;
    color: var(--text-dim);
  }

  /* ── Settings Chips ── */
  .chips {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 0.72rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .chip-on {
    background: #E8F5E1;
    color: #2D6A1E;
  }

  .chip-off {
    background: var(--bg);
    color: var(--text-dim);
  }

  /* ── Responsive ── */
  @media (max-width: 640px) {
    .content { padding: 24px 16px 60px; }
    .stat-grid { grid-template-columns: 1fr; }
    .topbar { padding: 0 16px; }
    th, td { padding: 10px 14px; }
    .header h1 { font-size: 1.6rem; }
  }
</style>
</head>
<body>

<header class="topbar">
  <div class="topbar-left">
    <div class="brand">
      <span class="brand-dot"></span>
      <span class="brand-name">Send</span>
    </div>
    <div class="divider"></div>
    <a href="${escHtml(viewUrl)}" class="back-link" target="_blank">View document &rarr;</a>
  </div>
</header>

<main class="content">
  <!-- Header -->
  <div class="header">
    <h1>${escHtml(doc.title)}</h1>
    <div class="header-meta">
      <span>Created ${createdDate}</span>
      <span>&middot;</span>
      <span>${totalViews} view${totalViews !== 1 ? "s" : ""}</span>
    </div>
    <div class="chips">
      <span class="chip ${doc.allow_download ? "chip-on" : "chip-off"}">
        ${doc.allow_download ? "&#10003;" : "&#10005;"} Download
      </span>
      <span class="chip ${doc.allow_print ? "chip-on" : "chip-off"}">
        ${doc.allow_print ? "&#10003;" : "&#10005;"} Print
      </span>
    </div>
    <div class="link-row">
      <div class="link-box" id="linkText">${escHtml(viewUrl)}</div>
      <button class="btn btn-primary" id="copyBtn">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5"/></svg>
        Copy link
      </button>
    </div>
  </div>

  <!-- Stats Cards -->
  <div class="stat-grid">
    <div class="stat-card">
      <div class="label">Total Views</div>
      <div class="value">${totalViews}</div>
      <div class="sub">All time</div>
    </div>
    <div class="stat-card">
      <div class="label">Unique Viewers</div>
      <div class="value">${uniqueIps}</div>
      <div class="sub">By IP address</div>
    </div>
    <div class="stat-card">
      <div class="label">Last Viewed</div>
      <div class="value" style="font-size: 1.4rem;">${views.length > 0 ? escHtml(formatAgo(views[0].viewed_at)) : "Never"}</div>
      <div class="sub">${views.length > 0 ? escHtml(new Date(views[0].viewed_at + "Z").toLocaleString("en-US")) : "No views yet"}</div>
    </div>
  </div>

  <!-- Views Table -->
  <div class="table-section">
    <div class="table-header">
      <h2>View History</h2>
      <span class="count">Showing ${views.length} of ${totalViews}</span>
    </div>
    <div class="table-wrap">
      ${views.length > 0 ? `
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>IP</th>
            <th>Browser</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          ${viewRows}
        </tbody>
      </table>
      ` : `
      <div class="empty">
        <div class="empty-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>
        </div>
        <p>No views yet. Share the link to start tracking.</p>
      </div>
      `}
    </div>
  </div>
</main>

<div class="copied-toast" id="toast">Copied to clipboard</div>

<script>
  document.getElementById('copyBtn').addEventListener('click', async () => {
    const url = document.getElementById('linkText').textContent;
    await navigator.clipboard.writeText(url);
    const toast = document.getElementById('toast');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  });
</script>

</body>
</html>`;
}

function formatAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr + "Z").getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function maskIp(ip: string): string {
  if (!ip || ip === "unknown") return "unknown";
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***`;
  }
  return ip.slice(0, Math.ceil(ip.length / 2)) + "***";
}

function parseBrowser(ua: string): string {
  if (!ua) return "Unknown";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("curl")) return "curl";
  return "Other";
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
