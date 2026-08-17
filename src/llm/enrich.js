// src/llm/enrich.js
// The enrichment logic. Stage 1 wires up stub mode only; the real model call, parsing,
// repair, timeout, retries, cost logging and kill switch are added in later stages.

import { OutputSchema, formatIssues } from './schema.js';
import { loadPrompt, chat } from './client.js';
import { extractJson } from './parse.js';

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
export async function callModelRaw(input, { signal } = {}) {
  const { version, text } = loadPrompt();
  const messages = buildMessages(input, text);
  const { content, usage } = await chat(messages, { signal });
  return { content, usage, promptVersion: version };
}

// Stage 3: full trustworthy path — parse, validate, and if either fails, make exactly ONE
// repair call handing the model its own broken output plus the validation error. If the
// repair also fails, throw an EnrichError so the route can 422 + quarantine (never crash,
// never return raw model text).
export class EnrichError extends Error {
  constructor(message, { rawOutput, promptVersion } = {}) {
    super(message);
    this.name = 'EnrichError';
    this.rawOutput = rawOutput;
    this.promptVersion = promptVersion;
  }
}

// Try to parse+validate one model text. Returns { ok:true, data } or { ok:false, reason }.
function parseAndValidate(content) {
  let obj;
  try {
    obj = extractJson(content);
  } catch (e) {
    return { ok: false, reason: `not valid JSON: ${e.message}` };
  }
  const result = OutputSchema.safeParse(obj);
  if (!result.success) return { ok: false, reason: formatIssues(result.error) };
  return { ok: true, data: result.data };
}

// The full enrichment: call -> validate -> (repair once) -> validate. Returns
// { data, usage, repairUsage, promptVersion, repaired } or throws EnrichError.
// `chatFn` is injectable so the parse/repair/quarantine logic can be tested without the
// network (defaults to the real provider call).
export async function enrich(input, { signal, chatFn = chat } = {}) {
  const { version, text } = loadPrompt();
  const messages = buildMessages(input, text);

  const first = await chatFn(messages, { signal });
  let check = parseAndValidate(first.content);
  if (check.ok) {
    return {
      data: check.data,
      usage: first.usage,
      repairUsage: null,
      promptVersion: version,
      repaired: false,
    };
  }

  // Repair exactly once: hand the model its own answer + the exact validation error.
  const repairMessages = [
    ...messages,
    { role: 'assistant', content: first.content },
    {
      role: 'user',
      content:
        `Your previous answer was rejected for this reason: ${check.reason}. ` +
        `Return only corrected JSON matching the schema. No prose, no code fences.`,
    },
  ];
  const second = await chatFn(repairMessages, { signal });
  check = parseAndValidate(second.content);
  if (check.ok) {
    return {
      data: check.data,
      usage: first.usage,
      repairUsage: second.usage,
      promptVersion: version,
      repaired: true,
    };
  }

  // Second attempt also failed — give up cleanly.
  throw new EnrichError(`model output failed validation after one repair: ${check.reason}`, {
    rawOutput: second.content,
    promptVersion: version,
  });
}
