// test/enrich.test.js — deterministic tests for the parse/validate/repair/quarantine
// logic, using an injected fake chat function (no network, no quota).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { enrich, EnrichError, buildMessages } from '../src/llm/enrich.js';
import { InputSchema, OutputSchema } from '../src/llm/schema.js';
import { extractJson } from '../src/llm/parse.js';

const INPUT = { title: 'Clean Code', description: 'A handbook of software craftsmanship.' };
const GOOD = JSON.stringify({
  category: 'nonfiction',
  summary: 'A guide to writing maintainable software.',
  audience: 'adult',
  quality_flags: [],
  confidence: 0.9,
});

// A fake chat that returns scripted responses in order.
function scripted(responses) {
  let i = 0;
  return async () => ({ content: responses[Math.min(i++, responses.length - 1)], usage: null });
}

test('happy path: valid JSON validates and returns, no repair', async () => {
  const out = await enrich(INPUT, { chatFn: scripted([GOOD]) });
  assert.equal(out.repaired, false);
  assert.equal(out.data.category, 'nonfiction');
});

test('parser strips code fences and prose', () => {
  const obj = extractJson('Sure! Here is the JSON:\n```json\n' + GOOD + '\n```');
  assert.equal(obj.category, 'nonfiction');
});

test('repair path: first answer invalid, repair fixes it -> repaired=true', async () => {
  const bad = JSON.stringify({ category: 'BANANA', summary: 'x', audience: 'adult', quality_flags: [], confidence: 0.9 });
  const out = await enrich(INPUT, { chatFn: scripted([bad, GOOD]) });
  assert.equal(out.repaired, true);
  assert.equal(out.data.category, 'nonfiction');
});

test('both attempts invalid -> throws EnrichError with rawOutput', async () => {
  const bad = 'not json at all';
  await assert.rejects(
    () => enrich(INPUT, { chatFn: scripted([bad, bad]) }),
    (err) => {
      assert.ok(err instanceof EnrichError);
      assert.match(err.message, /after one repair/);
      assert.equal(err.rawOutput, 'not json at all');
      return true;
    }
  );
});

test('input schema rejects an over-long title', () => {
  const r = InputSchema.safeParse({ title: 'x'.repeat(301) });
  assert.equal(r.success, false);
});

test('output schema rejects a category outside the closed list', () => {
  const r = OutputSchema.safeParse({
    category: 'banana',
    summary: 'x',
    audience: 'adult',
    quality_flags: [],
    confidence: 0.5,
  });
  assert.equal(r.success, false);
});

test('user content is a separate JSON-encoded user message, not glued into system', () => {
  const msgs = buildMessages(INPUT, 'SYSTEM PROMPT TEXT');
  assert.equal(msgs[0].role, 'system');
  assert.equal(msgs[0].content, 'SYSTEM PROMPT TEXT');
  assert.equal(msgs[1].role, 'user');
  assert.deepEqual(JSON.parse(msgs[1].content), INPUT);
});
