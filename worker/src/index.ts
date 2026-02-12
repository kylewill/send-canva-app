import { Hono } from "hono";
import { cors } from "hono/cors";
import { publishRoute } from "./routes/publish";
import { trackRoute } from "./routes/track";
import { fileRoute } from "./routes/file";
import { viewerPage } from "./pages/viewer";
import { statsPage } from "./pages/stats";

export type Env = {
  BUCKET: R2Bucket;
  DB: D1Database;
  BASE_URL: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", cors());

// API routes
app.route("/api/publish", publishRoute);
app.route("/api/track", trackRoute);
app.route("/api/file", fileRoute);

// Page routes
app.route("/view", viewerPage);
app.route("/stats", statsPage);

// Health check
app.get("/", (c) => c.json({ status: "ok", service: "send-canva-worker" }));

export default app;
