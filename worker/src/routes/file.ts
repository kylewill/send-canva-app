import { Hono } from "hono";
import type { Env } from "../index";

export const fileRoute = new Hono<{ Bindings: Env }>();

fileRoute.get("/:id", async (c) => {
  const id = c.req.param("id");

  // Look up the document
  const doc = await c.env.DB.prepare(
    `SELECT * FROM documents WHERE id = ?`
  )
    .bind(id)
    .first<{ id: string; title: string; r2_key: string; allow_download: number }>();

  if (!doc) {
    return c.text("Document not found", 404);
  }

  const object = await c.env.BUCKET.get(doc.r2_key);
  if (!object) {
    return c.text("File not found in storage", 404);
  }

  const headers = new Headers();
  headers.set("Content-Type", "application/pdf");
  headers.set("Cache-Control", "public, max-age=3600");

  if (!doc.allow_download) {
    headers.set("Content-Disposition", "inline");
  } else {
    headers.set("Content-Disposition", `attachment; filename="${doc.title}.pdf"`);
  }

  return new Response(object.body, { headers });
});
