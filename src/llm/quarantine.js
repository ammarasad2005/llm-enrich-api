// src/llm/quarantine.js
// A bad model answer is set aside with its reason — never crashed on, never returned to
// the caller. One JSON line per failure in logs/quarantine.jsonl.

import { appendFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(HERE, '..', '..', 'logs');
const QUARANTINE_FILE = join(LOG_DIR, 'quarantine.jsonl');

export function quarantine({ input, rawOutput, error, promptVersion }) {
  const line = {
    ts: new Date().toISOString(),
    prompt_version: promptVersion,
    model: process.env.LLM_MODEL,
    error,
    input,
    raw_output: rawOutput,
  };
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(QUARANTINE_FILE, JSON.stringify(line) + '\n');
  } catch {
    // Never let logging failure take the request down.
  }
}
