import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Shared API handlers (Single Source of Truth for local Express and Vercel Serverless)
import statusHandler from './api/status';
import chatHandler from './api/chat';
import ttsHandler from './api/tts';

dotenv.config({ path: '.env.local' });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Enable JSON body parsing with high limit for base64 images
app.use(express.json({ limit: '30mb' }));

/**
 * Adapter that converts Express (req, res) to Web Standard (Request -> Response).
 * This eliminates code duplication completely between server.ts (Express) and api/*.ts (Vercel).
 */
function adaptWebHandler(handler: (req: Request) => Promise<Response>) {
  return async (req: express.Request, res: express.Response) => {
    try {
      const protocol = req.protocol || 'http';
      const host = req.get('host') || `localhost:${PORT}`;
      const url = `${protocol}://${host}${req.originalUrl || req.url}`;

      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) {
          for (const v of value) headers.append(key, v);
        } else {
          headers.set(key, value);
        }
      }

      const method = req.method.toUpperCase();
      const init: RequestInit = {
        method,
        headers,
      };

      if (method !== 'GET' && method !== 'HEAD') {
        if (req.body && typeof req.body === 'object') {
          init.body = JSON.stringify(req.body);
        } else if (typeof req.body === 'string') {
          init.body = req.body;
        }
      }

      const webReq = new Request(url, init);
      const webRes = await handler(webReq);

      res.status(webRes.status);
      webRes.headers.forEach((value, key) => {
        if (key.toLowerCase() !== 'transfer-encoding') {
          res.setHeader(key, value);
        }
      });

      if (!webRes.body) {
        res.end();
        return;
      }

      const reader = webRes.body.getReader();
      req.on('close', () => {
        reader.cancel().catch(() => {});
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } catch (err: any) {
      console.error('API Error in handler adapter:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err?.message || 'Erro interno no servidor.' });
      } else {
        res.end();
      }
    }
  };
}

// Routes wired directly to single-source handlers
app.all('/api/status', adaptWebHandler(statusHandler));
app.all('/api/chat', adaptWebHandler(chatHandler));
app.all('/api/tts', adaptWebHandler(ttsHandler));

// Setup Vite middleware in dev or serve static files in production
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
