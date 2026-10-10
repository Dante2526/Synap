import { EdgeTTS } from '@andresaya/edge-tts';
import { checkAuthAndRateLimit } from './_security';

export const config = {
  runtime: 'nodejs',
  maxDuration: 60,
};

export default async function handler(req: Request) {
  const securityResponse = checkAuthAndRateLimit(req);
  if (securityResponse) return securityResponse;

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido.' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { text, voice, engine } = body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return new Response(JSON.stringify({ error: 'Texto não informado para leitura.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Clean text for speech synthesis
    const cleanText = text
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
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3500);

    if (!cleanText) {
      return new Response(JSON.stringify({ error: 'Texto limpo está vazio.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    const isGeminiRequested =
      (engine === 'gemini' || ['Aoede', 'Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'].includes(voice)) &&
      Boolean(geminiKey && geminiKey !== 'MY_GEMINI_API_KEY' && geminiKey.trim());

    // 1. If Gemini TTS requested and key exists, try Gemini TTS
    if (isGeminiRequested && geminiKey) {
      try {
        const validGeminiVoices = ['Aoede', 'Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];
        const geminiVoice = validGeminiVoices.includes(voice) ? voice : 'Aoede';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-lite-tts:generateContent?key=${geminiKey}`;

        const apiRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: cleanText,
                    speechMetadata: {
                      style: 'Locutor nativo em português do Brasil (pt-BR), entonação calorosa, fluente e natural, pronúncia brasileira autêntica e sem sotaque estrangeiro',
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: geminiVoice },
                },
              },
            },
          }),
        });

        if (apiRes.ok) {
          const data = await apiRes.json();
          const base64Audio = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (base64Audio) {
            const acceptHeader = req.headers.get('accept') || '';
            if (acceptHeader.includes('application/json') && !acceptHeader.includes('audio/')) {
              return new Response(
                JSON.stringify({
                  audio: base64Audio,
                  mimeType: 'audio/wav',
                  voice: geminiVoice,
                  engine: 'gemini',
                }),
                {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' },
                }
              );
            }
            const wavBuffer = Buffer.from(base64Audio, 'base64');
            const wavBytes = new Uint8Array(wavBuffer);
            return new Response(wavBytes, {
              status: 200,
              headers: {
                'Content-Type': 'audio/wav',
                'Content-Length': wavBytes.byteLength.toString(),
                'X-Voice-Used': geminiVoice,
                'X-TTS-Engine': 'gemini',
                'Cache-Control': 'public, max-age=3600',
              },
            });
          }
        }
      } catch (geminiError) {
        console.warn('Gemini TTS failed, falling back to Microsoft Edge TTS:', geminiError);
      }
    }

    // 2. Microsoft Edge TTS (100% Free, No API key needed, authentic pt-BR voices)
    let edgeVoice = 'pt-BR-FranciscaNeural';
    if (voice) {
      if (voice.includes('Antonio') || voice.includes('Puck') || voice.includes('Charon') || voice.includes('Fenrir')) {
        edgeVoice = 'pt-BR-AntonioNeural';
      } else if (voice.includes('Thalita') || voice.includes('Kore')) {
        edgeVoice = 'pt-BR-ThalitaMultilingualNeural';
      } else if (voice.startsWith('pt-BR-')) {
        edgeVoice = voice;
      }
    }

    const edgeTts = new EdgeTTS();
    await edgeTts.synthesize(cleanText, edgeVoice);
    const mp3Buffer = edgeTts.toBuffer();

    const acceptHeader = req.headers.get('accept') || '';
    if (acceptHeader.includes('application/json') && !acceptHeader.includes('audio/')) {
      return new Response(
        JSON.stringify({
          audio: mp3Buffer.toString('base64'),
          mimeType: 'audio/mpeg',
          voice: edgeVoice,
          engine: 'edge-tts',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const mp3Bytes = new Uint8Array(mp3Buffer);
    return new Response(mp3Bytes, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': mp3Bytes.byteLength.toString(),
        'X-Voice-Used': edgeVoice,
        'X-TTS-Engine': 'edge-tts',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    console.error('Edge TTS generation error:', error);
    return new Response(
      JSON.stringify({
        error: error?.message || 'Erro ao gerar áudio com Edge TTS.',
        fallback: 'web-speech',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
