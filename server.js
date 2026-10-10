// Generic Node adapter: Render, Railway, Fly.io, Heroku, Docker, a VPS, or your own PC.
// Serves index.html at "/" and the Gemini proxy at POST /api/gemini. No dependencies.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { handleGemini } = require('./lib/gemini-core');

const PORT = process.env.PORT || 3000;
const MAX_BODY = 15 * 1024 * 1024; // 15 MB

const send = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
};

http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];

  if (url === '/api/gemini') {
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    let raw = '';
    let tooBig = false;
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > MAX_BODY) { tooBig = true; req.destroy(); }
    });
    req.on('end', async () => {
      if (tooBig) return;
      let body = {};
      try { body = JSON.parse(raw || '{}'); } catch {}
      const { status, data } = await handleGemini(body, process.env);
      send(res, status, data);
    });
    return;
  }

  if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
    return fs.readFile(path.join(__dirname, 'index.html'), (err, html) => {
      if (err) return send(res, 500, { error: 'index.html not found' });
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    });
  }

  send(res, 404, { error: 'Not found' });
}).listen(PORT, () => console.log(`MediMind running on port ${PORT}`));
