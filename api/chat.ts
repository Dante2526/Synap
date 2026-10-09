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

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey || apiKey === 'sua_key_aqui' || apiKey === 'nvapi-your-key-here' || apiKey.trim() === '') {
    return new Response(
      JSON.stringify({
        error: 'NVIDIA_API_KEY não configurada na Vercel. Por favor, adicione a variável NVIDIA_API_KEY em Settings > Environment Variables no painel da Vercel.',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const body = await req.json();
    const { messages, model, reasoning_effort } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhuma mensagem informada.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const selectedModel = model || 'z-ai/glm-5.3';
    const selectedEffort = reasoning_effort || 'low';

    // Verify multimodal support
    const hasImages = messages.some((m: any) => m.images && Array.isArray(m.images) && m.images.length > 0);
    if (hasImages && selectedModel !== 'z-ai/glm-5.3-flash') {
      return new Response(
        JSON.stringify({ error: 'Este modelo não suporta imagens. Use o modelo GLM-5.3-Flash.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Format messages for OpenAI standard
    const formattedMessages = messages.map((m: any) => {
      if (m.role === 'user' && m.images && Array.isArray(m.images) && m.images.length > 0) {
        return {
          role: 'user',
          content: [
            { type: 'text', text: m.content || '' },
            ...m.images.map((img: string) => ({
              type: 'image_url',
              image_url: { url: img },
            })),
          ],
        };
      }
      return {
        role: m.role,
        content: m.content || '',
      };
    });

    const payload = {
      model: selectedModel,
      messages: formattedMessages,
      stream: true,
      reasoning_effort: selectedEffort,
    };

    const nvidiaRes = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify(payload),
    });

    if (!nvidiaRes.ok) {
      const errText = await nvidiaRes.text();
      let errMsg = `Erro da API NVIDIA (${nvidiaRes.status})`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed?.error?.message) {
          errMsg = parsed.error.message;
        } else if (parsed?.message) {
          errMsg = parsed.message;
        }
      } catch {
        if (errText) errMsg = errText;
      }

      if (nvidiaRes.status === 401) {
        errMsg = 'Chave NVIDIA_API_KEY inválida. Verifique sua chave nas Environment Variables da Vercel.';
      } else if (nvidiaRes.status === 429) {
        errMsg = 'Muitas requisições (Rate Limit). Espere um momento antes de tentar novamente.';
      }

      return new Response(JSON.stringify({ error: errMsg }), {
        status: nvidiaRes.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(nvidiaRes.body, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || 'Erro ao processar mensagem.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
