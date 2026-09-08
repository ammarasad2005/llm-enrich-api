// src/app.js — the Express app, exported without calling listen().
// This lets the same app run locally (src/index.js) and as a serverless
// function on Vercel (api/index.js).
import express from 'express';
import { enrichRouter } from './routes/enrich.js';

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/', (req, res) => {
    res.json({ message: 'LLM enrich API is running.', endpoint: 'POST /enrich' });
  });

  app.use(enrichRouter);

  // Turn malformed JSON bodies into a clean 400 instead of a stack trace.
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Malformed JSON body' });
    }
    return res.status(500).json({ error: 'Internal error' });
  });

  return app;
}
