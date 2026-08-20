// evals/run.js
// Run the 8 labelled cases through the running endpoint and score the key field
// (category), plus check any `quality_flags_include` / `when-unsure` expectations.
//
// Usage: start the server (npm start) in one terminal, then:  node evals/run.js
// Optional: EVAL_URL=http://localhost:3000/enrich node evals/run.js

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(readFileSync(join(HERE, 'cases.json'), 'utf8'));
const URL = process.env.EVAL_URL || 'http://localhost:3000/enrich';

function checkCase(expected, got) {
  const notes = [];
  let pass = true;
  if (expected.category && got.category !== expected.category) {
    pass = false;
    notes.push(`category: expected ${expected.category}, got ${got.category}`);
  }
  if (expected.quality_flags_include) {
    const flags = got.quality_flags || [];
    if (!flags.includes(expected.quality_flags_include)) {
      pass = false;
      notes.push(`flags: expected to include ${expected.quality_flags_include}, got [${flags}]`);
    }
  }
  return { pass, notes };
}

const results = [];
for (const c of cases) {
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c.input),
    });
    const got = await res.json();
    const { pass, notes } = checkCase(c.expected, got);
    results.push({ name: c.name, pass, status: res.status, notes, got });
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${c.name}${notes.length ? '  (' + notes.join('; ') + ')' : ''}`);
  } catch (err) {
    results.push({ name: c.name, pass: false, notes: [err.message] });
    console.log(`ERROR ${c.name}  (${err.message})`);
  }
}

const passed = results.filter((r) => r.pass).length;
console.log(`\nScore: ${passed} / ${cases.length} on category (+ flag checks)`);
console.log(`Model: ${process.env.LLM_MODEL || '(server-side)'}  Date: ${new Date().toISOString().slice(0, 10)}`);
