import { checkAuthAndRateLimit, ALLOWED_MODELS } from './_security.ts';

export const config = {
  runtime: 'nodejs',
  maxDuration: 60, // 60s (limite do plano Hobby da Vercel)
};

export default async function handler(req: Request) {
  try {
    const securityResponse = checkAuthAndRateLimit(req);
    if (securityResponse) return securityResponse;
  } catch (secErr: any) {
    console.error('Security check error:', secErr);
    // Não bloqueia a requisição por erro de security check — apenas loga
  }

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
        error: 'NVIDIA_API_KEY não configurada. Por favor, adicione sua chave NVIDIA no arquivo .env.local ou nas Environment Variables da Vercel.',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const body = await req.json();
    let { messages } = body;
    const { model, reasoning_effort, tools } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhuma mensagem informada.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (messages.length > 40) {
      // Retém o system prompt (se for o primeiro) + as últimas 39 mensagens
      const sys = messages[0]?.role === 'system' ? [messages[0]] : [];
      messages = [...sys, ...messages.slice(-39)];
    }

    const selectedModel = model || 'z-ai/glm-5.3';
    if (!ALLOWED_MODELS.includes(selectedModel)) {
      return new Response(JSON.stringify({ error: 'Modelo não autorizado.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const selectedEffort = reasoning_effort || 'low';

    // Verify multimodal support
    const hasImages = messages.some((m: any) => m.images && Array.isArray(m.images) && m.images.length > 0);
    const isVisionModel = selectedModel === 'z-ai/glm-5.3-flash' || selectedModel === 'moonshotai/kimi-k3';
    if (hasImages && !isVisionModel) {
      return new Response(
        JSON.stringify({ error: 'Este modelo não suporta imagens. Use o modelo GLM-5.3-Flash ou Kimi K3.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    let lastUserMsgIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserMsgIndex = i;
        break;
      }
    }

    // Format messages for OpenAI standard, supporting tools & tool results
    const formattedMessages = messages.map((m: any, index: number) => {
      if (m.role === 'tool') {
        return {
          role: 'tool',
          content: m.content || '',
          tool_call_id: m.tool_call_id,
        };
      }
      if (m.role === 'assistant' && m.tool_calls) {
        return {
          role: 'assistant',
          content: m.content || '',
          tool_calls: m.tool_calls,
        };
      }
      if (m.role === 'user' && m.images && Array.isArray(m.images) && m.images.length > 0) {
        if (index === lastUserMsgIndex) {
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
        } else {
          return {
            role: 'user',
            content: `${m.content || ''}\n[Nota do Sistema: ${m.images.length} imagem(ns) enviada(s) omitida(s) do histórico para economizar tokens]`,
          };
        }
      }
      return {
        role: m.role,
        content: m.content || '',
      };
    });

    const createPayload = (includeReasoning = true, includeTools = true) => {
      const p: any = {
        model: selectedModel,
        messages: formattedMessages,
        stream: true,
        stream_options: { include_usage: true },
        max_tokens: 4096, // Reduzido de 8192 pra diminuir over-thinking e acelerar resposta
      };
      if (includeReasoning && selectedEffort && selectedEffort !== 'none' && selectedEffort !== 'default') {
        p.reasoning_effort = selectedEffort;
      }
      if (includeTools && tools && Array.isArray(tools) && tools.length > 0) {
        p.tools = tools;
        p.tool_choice = 'auto';
      }
      return p;
    };

    let payload = createPayload(true, true);

    let nvidiaRes = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify(payload),
    });

    let fallbackType = 'none';

    // Fallback 1: se der erro de validação/formato e reasoning_effort estava incluído
    if (!nvidiaRes.ok && (nvidiaRes.status === 400 || nvidiaRes.status === 422) && payload.reasoning_effort) {
      await nvidiaRes.body?.cancel().catch(() => {});
      payload = createPayload(false, true);
      nvidiaRes = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify(payload),
      });
      fallbackType = 'no-reasoning';
    }

    // Fallback 2: se der erro e as ferramentas estavam sendo usadas
    if (!nvidiaRes.ok && (nvidiaRes.status === 400 || nvidiaRes.status === 422) && payload.tools) {
      await nvidiaRes.body?.cancel().catch(() => {});
      payload = createPayload(false, false);
      nvidiaRes = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify(payload),
      });
      fallbackType = fallbackType === 'no-reasoning' ? 'no-reasoning-and-tools' : 'no-tools';
    }

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

    const headers: Record<string, string> = {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-Content-Type-Options': 'nosniff',
    };

    if (fallbackType !== 'none') {
      headers['x-fallback'] = fallbackType;
    }

    // TransformStream que faz flush imediato de cada chunk recebido da NVIDIA
    // Sem isso, a Vercel pode bufferizar e só mandar tudo de uma vez no final
    // Fallback: se TransformStream não estiver disponível, usa o body direto
    let streamedBody: ReadableStream<Uint8Array> | null = null;
    try {
      if (nvidiaRes.body) {
        if (typeof TransformStream !== 'undefined') {
          const flushStream = new TransformStream({
            transform(chunk, controller) {
              controller.enqueue(chunk);
            },
            flush(controller) {
              controller.terminate();
            },
          });
          streamedBody = nvidiaRes.body.pipeThrough(flushStream);
        } else {
          // Node mais antigo sem TransformStream global — usa body direto
          streamedBody = nvidiaRes.body;
        }
      }
    } catch (streamErr) {
      console.warn('TransformStream setup failed, using raw body:', streamErr);
      streamedBody = nvidiaRes.body;
    }

    return new Response(streamedBody, { headers });
  } catch (error: any) {
    console.error('Chat API error 500:', {
      message: error?.message,
      stack: error?.stack?.split('\n').slice(0, 5).join(' | '),
      name: error?.name,
    });
    const errMsg = error?.message || 'Erro ao processar mensagem.';
    return new Response(JSON.stringify({ error: errMsg, errorName: error?.name || 'Unknown' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
