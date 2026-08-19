// src/routes/enrich.js
// POST /enrich — validate the input, then (Stage 1) return a stub. Later stages call
// the model here. The route stays thin: validation + delegation, no prompt strings.

import { Router } from 'express';
import { InputSchema, formatIssues } from '../llm/schema.js';
import { stubEnrichment, fallbackEnrichment, enrich, EnrichError } from '../llm/enrich.js';
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

  // 3) Kill switch: when LLM_ENABLED=false, never call the model — return a safe,
  //    deterministic fallback so the feature can be turned off without a deploy.
  if (process.env.LLM_ENABLED === 'false') {
    return res.status(200).json({ ...fallbackEnrichment(input), _mode: 'fallback' });
  }

  // 4) call -> parse -> validate -> repair once -> quarantine + 422 on failure.
  //    Raw model text is NEVER returned to the caller; the schema is the contract.
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
    // A timed-out model call -> 504 (something we depend on took too long).
    if (err?.name === 'APIConnectionTimeoutError' || err?.name === 'AbortError') {
      return res.status(504).json({ error: 'The model took too long to respond. Try again.' });
    }
    // A rejected key / forbidden -> fail fast, clear error (never retried upstream).
    const status = err?.status ?? err?.response?.status;
    if (status === 401 || status === 403) {
      return res.status(502).json({ error: 'Model provider rejected the request (auth).' });
    }
    return res.status(502).json({ error: `Upstream model error: ${err.message}` });
  }
});
