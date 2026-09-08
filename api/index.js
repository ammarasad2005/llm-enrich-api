// api/index.js — Vercel serverless entry.
// Vercel gives each request to this handler; we hand it to the Express app.
// vercel.json rewrites every path here, so Express sees the real URL and routes
// (GET /, POST /enrich) work unchanged.
import { createApp } from '../src/app.js';

const app = createApp();

export default function handler(req, res) {
  return app(req, res);
}
