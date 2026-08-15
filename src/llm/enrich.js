// src/llm/enrich.js
// The enrichment logic. Stage 1 wires up stub mode only; the real model call, parsing,
// repair, timeout, retries, cost logging and kill switch are added in later stages.

import { OutputSchema } from './schema.js';

// A fixed, schema-valid answer used when LLM_STUB=1. Lets us build and restart the
// server dozens of times without spending a single model call / quota unit.
export function stubEnrichment(input) {
  const flags = [];
  if (!input.description || input.description.trim() === '') flags.push('missing-description');
  else if (input.description.trim().length < 30) flags.push('too-short');

  const stub = {
    category: 'other',
    summary: `Stubbed enrichment for "${input.title}".`.slice(0, 200),
    audience: 'all-ages',
    quality_flags: flags,
    confidence: 0.42,
  };
  // Guarantee the stub itself satisfies the contract (fail fast if we ever break it).
  return OutputSchema.parse(stub);
}
