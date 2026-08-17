// src/llm/enrich.js
// The enrichment logic. Stage 1 wires up stub mode only; the real model call, parsing,
// repair, timeout, retries, cost logging and kill switch are added in later stages.

import { OutputSchema } from './schema.js';
import { loadPrompt, chat } from './client.js';

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

// Build the messages array: the versioned prompt as the SYSTEM message, and the caller's
// data as a SEPARATE USER message. Never glue user content into the system prompt — the
// roles are a security boundary (Stage 2, reinforced in the prompt's injection rules).
export function buildMessages(input, promptText) {
  return [
    { role: 'system', content: promptText },
    // JSON-encode the untrusted input so it cannot "break out" of its role.
    { role: 'user', content: JSON.stringify({ title: input.title, description: input.description }) },
  ];
}

// Stage 2: make one real model call and return the raw text + usage + prompt version.
// (Parsing, validation, repair and quarantine are added in Stage 3.)
export async function callModelRaw(input, { signal } = {}) {
  const { version, text } = loadPrompt();
  const messages = buildMessages(input, text);
  const { content, usage } = await chat(messages, { signal });
  return { content, usage, promptVersion: version };
}
