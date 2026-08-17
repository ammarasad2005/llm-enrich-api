// src/routes/enrich.js
// POST /enrich — validate the input, then (Stage 1) return a stub. Later stages call
// the model here. The route stays thin: validation + delegation, no prompt strings.

import { Router } from 'express';
import { InputSchema, formatIssues } from '../llm/schema.js';
import { stubEnrichment, enrich, EnrichError } from '../llm/enrich.js';
import { quarantine } from '../llm/quarantine.js';

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

  // Stage 3: call -> parse -> validate -> repair once -> quarantine + 422 on failure.
  // Raw model text is NEVER returned to the caller; the schema is the contract.
  try {
    const { data } = await enrich(input);
    return res.status(200).json(data);
  } catch (err) {
    if (err instanceof EnrichError) {
      quarantine({
        input,
        rawOutput: err.rawOutput,
        error: err.message,
        promptVersion: err.promptVersion,
      });
      return res.status(422).json({ error: 'Could not produce a valid result for this input.' });
    }
    // Unexpected error (e.g. provider/network) — surfaced in Stage 4 with timeouts/retries.
    return res.status(502).json({ error: `Upstream model error: ${err.message}` });
  }
});
