// src/routes/enrich.js
// POST /enrich — validate the input, then (Stage 1) return a stub. Later stages call
// the model here. The route stays thin: validation + delegation, no prompt strings.

import { Router } from 'express';
import { InputSchema, formatIssues } from '../llm/schema.js';
import { stubEnrichment } from '../llm/enrich.js';

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

  // (Stages 2-4 replace this with the real, guarded model call.)
  return res.status(501).json({ error: 'Model path not implemented yet (set LLM_STUB=1)' });
});
