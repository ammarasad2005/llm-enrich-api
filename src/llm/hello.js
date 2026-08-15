// src/llm/hello.js — Stage 0 throwaway probe.
// Proves we can get one word back from a model. The SAME code works for any
// OpenAI-compatible provider (OpenRouter, Ollama, ...) — only three env vars change.
// Run: node --env-file=.env src/llm/hello.js
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: process.env.LLM_BASE_URL,
  apiKey: process.env.LLM_API_KEY,
});

const res = await client.chat.completions.create({
  model: process.env.LLM_MODEL,
  messages: [{ role: 'user', content: 'Reply with exactly the word: ready' }],
});

console.log(res.choices[0].message.content);
