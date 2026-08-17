// src/routes/enrich.js
// POST /enrich — validate the input, then (Stage 1) return a stub. Later stages call
// the model here. The route stays thin: validation + delegation, no prompt strings.

import { Router } from 'express';
import { InputSchema, OutputSchema, formatIssues } from '../llm/schema.js';
import { stubEnrichment, callModelRaw } from '../llm/enrich.js';
import { extractJson } from '../llm/parse.js';

export const enrichRouter = Router();

enrichRouter.post('/enrich', async (req, res) => {
  // 1) Validate the input BEFORE anything else — a rejected request is a model call
  //    we never pay for.
  const parsed = InputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: formatIssues(parsed.error) });
  }
  const input = parsed.data;

  // 2) Stub mode: skip the model entirely, return a fixed schema-valid object.
  if (process.env.LLM_STUB === '1') {
    return res.status(200).json({ ...stubEnrichment(input), _mode: 'stub' });
  }

  // Stage 2: make a real model call, parse the JSON, and validate against the schema.
  // (Stage 3 adds the repair retry + quarantine; Stage 4 adds timeout/retries/logging.)
  try {
    const { content } = await callModelRaw(input);
    const obj = extractJson(content); // strip code fences etc., then JSON.parse
    const validated = OutputSchema.parse(obj); // throws if the shape is wrong
    return res.status(200).json(validated);
  } catch (err) {
    return res.status(502).json({ error: `Model call/parse failed: ${err.message}` });
  }
});
