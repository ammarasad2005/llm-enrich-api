// src/llm/client.js
// Provider-agnostic model access. The route never knows which provider is behind this —
// swapping OpenRouter <-> Ollama is three env vars, no code change.

import OpenAI from 'openai';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(HERE, '..', '..', 'prompts');

// Load a versioned system prompt from a file. Prompts are code: versioned and diffable.
export function loadPrompt(version = process.env.PROMPT_VERSION || 'v1') {
  const path = join(PROMPTS_DIR, `enrich-${version}.md`);
  return { version, text: readFileSync(path, 'utf8') };
}

// One shared client. Timeout is set EXPLICITLY (Stage 4) — never the 10-minute SDK default.
let _client = null;
export function getClient() {
  if (!_client) {
    _client = new OpenAI({
      baseURL: process.env.LLM_BASE_URL,
      apiKey: process.env.LLM_API_KEY,
      timeout: 30_000, // 30s — an HTTP endpoint cannot hold a connection for 10 minutes
      maxRetries: 0, // we run our OWN retry policy (Stage 4); no silent SDK retries
    });
  }
  return _client;
}

// Make one raw chat completion. Returns { content, usage }.
// `messages` is a full messages array so the caller controls system/user separation.
export async function chat(messages, { signal } = {}) {
  const client = getClient();
  const res = await client.chat.completions.create(
    {
      model: process.env.LLM_MODEL,
      temperature: 0, // classification: we want the same answer every time
      messages,
    },
    { signal }
  );
  return {
    content: res.choices?.[0]?.message?.content ?? '',
    usage: res.usage ?? null,
  };
}
