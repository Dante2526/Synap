export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido.' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return new Response(
      JSON.stringify({ error: 'GEMINI_API_KEY não configurada na Vercel para voz neural.' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const { text, voice = 'Kore' } = await req.json();
    if (!text || typeof text !== 'string' || !text.trim()) {
      return new Response(JSON.stringify({ error: 'Texto não informado.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const clean = text
      .replace(/<think>[\s\S]*?<\/think>/g, '')
      .replace(/```[\s\S]*?```/g, ' Trecho de código omitido. ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\|[^\n]+\|/g, '')
      .replace(/^[\s]*[-*+]\s+/gm, '')
      .replace(/^[\s]*\d+\.\s+/gm, '')
      .replace(/[*_~]{1,3}/g, '')
      .replace(/\n+/g, '. ')
      .trim()
      .slice(0, 2000);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-lite-tts:generateContent?key=${geminiKey}`;

    const apiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: clean }],
          },
        ],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice || 'Kore' },
            },
          },
        },
      }),
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      return new Response(JSON.stringify({ error: `Erro na API TTS: ${errText}` }), {
        status: apiRes.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await apiRes.json();
    const base64Audio = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      return new Response(JSON.stringify({ error: 'Áudio não retornado pelo modelo.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        audio: base64Audio,
        mimeType: 'audio/wav',
        voice: voice || 'Kore',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || 'Erro ao processar TTS.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
