// Vercel function -> /api/gemini (self-contained, key stays on the server)
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not set on the server.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);
    body = body || {};

    const { type, prompt, systemInstruction, image, mimeType } = body;

    if (typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'Missing prompt.' });
    }

    const textModel = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
    const imageModel = process.env.GEMINI_VISION_MODEL || 'gemini-3.1-flash-image';

    const parts = [{ text: prompt }];
    let model = textModel;

    if (type === 'image') {
      if (typeof image !== 'string' || typeof mimeType !== 'string') {
        return res.status(400).json({ error: 'Missing image data.' });
      }
      parts.push({ inlineData: { mimeType: mimeType, data: image } });
      model = imageModel;
    }

    const payload = {
      contents: [{ role: 'user', parts: parts }],
      systemInstruction: {
        parts: [{ text: systemInstruction || 'You are a helpful medical assistant.' }],
      },
    };

    const upstream = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(payload),
      }
    );

    const data = await upstream.json();

    if (!upstream.ok) {
      console.error('Gemini error:', upstream.status, JSON.stringify(data));
      return res.status(upstream.status).json({
        error: (data && data.error && data.error.message) || 'Gemini request failed.',
      });
    }

    const candidate = data.candidates && data.candidates[0];
    const outParts = (candidate && candidate.content && candidate.content.parts) || [];
    const text = outParts.map(function (p) { return p.text || ''; }).join('');
    return res.status(200).json({ text: text });
  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: 'Server error while contacting Gemini.' });
  }
};
