// Vercel adapter -> /api/gemini
const { handleGemini } = require('../lib/gemini-core');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  let body = req.body;
  try { if (typeof body === 'string') body = JSON.parse(body); } catch { body = {}; }
  const { status, data } = await handleGemini(body, process.env);
  return res.status(status).json(data);
};
