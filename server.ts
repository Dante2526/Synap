import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: '.env.local' });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Enable JSON body parsing with high limit for base64 images
app.use(express.json({ limit: '30mb' }));

// Health / Status endpoint (never exposes key value, only whether it is configured)
app.get('/api/status', (req, res) => {
  const rawKey = process.env.NVIDIA_API_KEY || '';
  const isPlaceholder = rawKey === 'sua_key_aqui' || rawKey === 'nvapi-your-key-here' || rawKey.trim() === '';
  res.json({
    status: 'ok',
    hasApiKey: !isPlaceholder,
  });
});

// Proxy route for NVIDIA NIM Chat Completions
app.post('/api/chat', async (req, res) => {
  const apiKey = process.env.NVIDIA_API_KEY;

  if (!apiKey || apiKey === 'sua_key_aqui' || apiKey === 'nvapi-your-key-here' || apiKey.trim() === '') {
    return res.status(401).json({
      error: 'NVIDIA_API_KEY não configurada no servidor. Por favor, configure a chave no arquivo .env.local ou nas variáveis de ambiente.',
    });
  }

  const { messages, model, reasoning_effort } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Nenhuma mensagem informada.' });
  }

  const selectedModel = model || 'z-ai/glm-5.3';
  const selectedEffort = reasoning_effort || 'low';

  // Check if any message has images
  const hasImages = messages.some((m: any) => m.images && Array.isArray(m.images) && m.images.length > 0);
  if (hasImages && selectedModel !== 'z-ai/glm-5.3-flash') {
    return res.status(400).json({
      error: 'Este modelo não suporta imagens. Use o modelo GLM-5.3-Flash.',
    });
  }

  // Format messages for OpenAI standard compatibility
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

  // CRITICAL REQUIREMENT:
  // reasoning_effort must be at root level, NOT nested in chat_template_kwargs
  const payload = {
    model: selectedModel,
    messages: formattedMessages,
    stream: true,
    reasoning_effort: selectedEffort,
  };

  try {
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
        errMsg = 'Chave NVIDIA_API_KEY inválida ou não autorizada. Verifique sua chave no .env.local.';
      } else if (nvidiaRes.status === 429) {
        errMsg = 'Muitas requisições (Rate Limit). Espere um minuto antes de tentar novamente.';
      }

      return res.status(nvidiaRes.status).json({ error: errMsg });
    }

    // Stream SSE directly to the client
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    if (!nvidiaRes.body) {
      res.end();
      return;
    }

    const reader = nvidiaRes.body.getReader();

    req.on('close', () => {
      reader.cancel().catch(() => {});
    });

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (error: any) {
    console.error('API Error in /api/chat:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error?.message || 'Falha na comunicação com o servidor NVIDIA.' });
    } else {
      res.end();
    }
  }
});

// Setup Vite middleware or serve static files
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NVIDIA NIM Chat Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
