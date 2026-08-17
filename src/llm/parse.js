// src/llm/parse.js
// Models like to wrap JSON in ```code fences``` or prefix "Sure! Here's the JSON:".
// This pulls the actual object out and JSON.parses it. It THROWS on failure — the caller
// decides what to do (repair, then quarantine). It never returns a half-parsed guess.

export function extractJson(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    throw new Error('empty model response');
  }

  let s = text.trim();

  // Strip a leading/trailing markdown code fence if present (```json ... ```).
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) s = fence[1].trim();

  // If there is prose around the object, grab the outermost {...} span.
  if (!s.startsWith('{')) {
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
      s = s.slice(first, last + 1);
    }
  }

  return JSON.parse(s); // throws SyntaxError on malformed JSON -> handled upstream
}
