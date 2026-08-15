// src/llm/schema.js
// The contract. Both the request and the model's response are validated against these
// Zod schemas — the model's answer is untrusted input, exactly like scraped data.

import { z } from 'zod';

// Closed lists, straight from JOB-CARD.md.
export const CATEGORIES = ['fiction', 'nonfiction', 'childrens', 'poetry', 'reference', 'other'];
export const AUDIENCES = ['children', 'young-adult', 'adult', 'all-ages'];
export const QUALITY_FLAGS = ['missing-description', 'too-short', 'possible-spam', 'non-english'];

// ---- Input schema: what the caller must send ----
export const InputSchema = z
  .object({
    title: z.string().min(1, 'must not be empty').max(300, 'must be <= 300 characters'),
    description: z.string().max(5000, 'must be <= 5000 characters').optional().default(''),
  })
  .strict(); // reject unknown fields so typos surface as 400s

// ---- Output schema: what the endpoint promises to return ----
export const OutputSchema = z
  .object({
    category: z.enum(CATEGORIES),
    summary: z.string().min(1).max(200),
    audience: z.enum(AUDIENCES),
    quality_flags: z.array(z.enum(QUALITY_FLAGS)),
    confidence: z.number().min(0).max(1),
  })
  .strict();

// Format Zod issues into a short, field-naming message for a 400/422 body.
export function formatIssues(error) {
  return error.issues
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ');
}
