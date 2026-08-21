// ai-version/src/server.js
// QUARANTINED — the AI's attempt at the assignment, kept for the "AI vs me" review.
// It is NOT the submission. It contains several realistic issues I found on review; see
// the "AI vs me" section of the main README.

import express from 'express';
import OpenAI from 'openai';
import { z } from 'zod';
import { readFileSync } from 'node:fs';

const app = express();
app.use(express.json());

// No explicit timeout -> the SDK default is TEN MINUTES. One slow call hangs the endpoint.
// SDK default maxRetries is 2 and is left in place -> it will even retry a 401.
const client = new OpenAI({ apiKey: process.env.LLM_API_KEY, baseURL: process.env.LLM_BASE_URL });

const InputSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
});

const OutputSchema = z.object({
  category: z.enum(['fiction', 'nonfiction', 'childrens', 'poetry', 'reference', 'other']),
  summary: z.string(),
  audience: z.enum(['children', 'young-adult', 'adult', 'all-ages']),
  quality_flags: z.array(z.string()),
  confidence: z.number(),
});

const prompt = readFileSync(new URL('../prompts/enrich.md', import.meta.url), 'utf8');

app.post('/enrich', async (req, res) => {
  const parsed = InputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const completion = await client.chat.completions.create({
    model: process.env.LLM_MODEL,
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: `Title: ${req.body.title}\nDescription: ${req.body.description || ''}` },
    ],
  });

  const text = completion.choices[0].message.content;
  try {
    const json = JSON.parse(text);
    const valid = OutputSchema.parse(json);
    res.json(valid);
  } catch (e) {
    // Returns the RAW model text straight to the caller on failure — no repair, no
    // quarantine, no contract. Also no cost log, no kill switch, no stub mode.
    res.json({ raw: text });
  }
});

app.listen(3000, () => console.log('AI version listening on 3000'));
