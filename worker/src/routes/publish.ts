import { Hono } from "hono";
import { nanoid } from "nanoid";
import type { Env } from "../index";

export const publishRoute = new Hono<{ Bindings: Env }>();

publishRoute.post("/", async (c) => {
  const body = await c.req.json<{
    fileUrl: string;
    title: string;
    slug?: string;
    allowDownload?: boolean;
    allowPrint?: boolean;
  }>();

  const { fileUrl, title } = body;
  if (!fileUrl || !title) {
    return c.json({ error: "fileUrl and title are required" }, 400);
  }

  // Download the file from Canva's temp URL
  const fileResponse = await fetch(fileUrl);
  if (!fileResponse.ok) {
    return c.json({ error: "Failed to download file from provided URL" }, 502);
  }

  const id = nanoid(12);
  const slug = body.slug?.replace(/[^a-z0-9-]/gi, "-").toLowerCase() || `${title.replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 30)}-${nanoid(8)}`;
  const r2Key = `documents/${id}.pdf`;

  // Store in R2
  const fileBuffer = await fileResponse.arrayBuffer();
  await c.env.BUCKET.put(r2Key, fileBuffer, {
    httpMetadata: { contentType: "application/pdf" },
  });

  // Create D1 record
  await c.env.DB.prepare(
    `INSERT INTO documents (id, title, slug, r2_key, allow_download, allow_print) VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(id, title, slug, r2Key, body.allowDownload ? 1 : 0, body.allowPrint ? 1 : 0)
    .run();

  const baseUrl = c.env.BASE_URL || `https://${c.req.header("host")}`;

  return c.json({
    id,
    slug,
    viewUrl: `${baseUrl}/view/${slug}`,
    statsUrl: `${baseUrl}/stats/${slug}`,
  });
});
