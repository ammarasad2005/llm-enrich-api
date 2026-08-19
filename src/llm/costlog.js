// src/llm/costlog.js
// One structured line per model call, written to stdout (Twelve-Factor: let the
// environment route logs; don't invent a log file). "You cannot manage what you do not
// measure" — this is the data behind "what will this cost at 10,000/day?".

export function logCost({
  promptVersion,
  model,
  inputTokens,
  outputTokens,
  durationMs,
  repaired,
  retries,
}) {
  const line = {
    at: new Date().toISOString(),
    event: 'llm_call',
    prompt_version: promptVersion,
    model,
    input_tokens: inputTokens ?? null,
    output_tokens: outputTokens ?? null,
    total_tokens: (inputTokens ?? 0) + (outputTokens ?? 0),
    duration_ms: durationMs,
    repaired: !!repaired,
    retries: retries ?? 0,
  };
  console.log(JSON.stringify(line));
  return line;
}
