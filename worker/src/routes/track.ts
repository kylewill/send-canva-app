import { Hono } from "hono";
import { nanoid } from "nanoid";
import type { Env } from "../index";

export const trackRoute = new Hono<{ Bindings: Env }>();

trackRoute.post("/", async (c) => {
  const body = await c.req.json<{ documentId: string }>();
  if (!body.documentId) {
    return c.json({ error: "documentId is required" }, 400);
  }

  const id = nanoid(12);
  const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "unknown";
  const userAgent = c.req.header("user-agent") || "unknown";
  const referer = c.req.header("referer") || "";

  await c.env.DB.prepare(
    `INSERT INTO views (id, document_id, ip_address, user_agent, referer) VALUES (?, ?, ?, ?, ?)`
  )
    .bind(id, body.documentId, ip, userAgent, referer)
    .run();

  return c.json({ ok: true });
});
