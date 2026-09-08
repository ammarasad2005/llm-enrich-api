// src/index.js — local entrypoint. Starts a normal HTTP server.
// On Vercel the app is served through api/index.js instead (no listen()).
import { createApp } from './app.js';

const app = createApp();
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
