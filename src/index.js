// src/index.js — the API server
import express from 'express';
import { enrichRouter } from './routes/enrich.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
