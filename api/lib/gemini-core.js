// Shared Gemini proxy logic used by every deployment adapter.
// Takes the parsed request body and an env object; returns { status, data }.

async function handleGemini(body, env) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return { status: 500, data: { error: 'GEMINI_API_KEY is not set on the server.' } };
  }

  const textModel = env.GEMINI_MODEL || 'gemini-3-flash-preview';
  const imageModel = env.GEMINI_VISION_MODEL || 'gemini-3.1-flash-image';

  const { type, prompt, systemInstruction, image, mimeType } = body || {};

  if (typeof prompt !== 'string' || !prompt.trim()) {
    return { status: 400, data: { error: 'Missing prompt.' } };
  }

  const parts = [{ text: prompt }];
  let model = textModel;

  if (type === 'image') {
    if (typeof image !== 'string' || typeof mimeType !== 'string') {
      return { status: 400, data: { error: 'Missing image data.' } };
    }
    parts.push({ inlineData: { mimeType, data: image } });
    model = imageModel;
  }

  const payload = {
    contents: [{ role: 'user', parts }],
    systemInstruction: {
      parts: [{ text: systemInstruction || 'You are a helpful medical assistant.' }],
    },
  };

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(payload),
      }
    );
    const data = await upstream.json();

    if (!upstream.ok) {
      console.error('Gemini error:', upstream.status, JSON.stringify(data));
      return { status: upstream.status, data: { error: data?.error?.message || 'Gemini request failed.' } };
    }

    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    return { status: 200, data: { text } };
  } catch (err) {
    console.error('Proxy error:', err);
    return { status: 500, data: { error: 'Server error while contacting Gemini.' } };
  }
}

module.exports = { handleGemini };
