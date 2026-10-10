// Endpoint de teste minimalista pra isolar o problema
// Se esse funcionar e /api/chat não, sabemos que o problema é específico do chat.ts

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  return new Response(JSON.stringify({
    ok: true,
    message: 'Endpoint de teste funcionando',
    time: new Date().toISOString(),
    env: {
      hasNvidiaKey: Boolean(process.env.NVIDIA_API_KEY),
      hasGitHubToken: Boolean(process.env.GITHUB_TOKEN || process.env.GITHUB_PAT),
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      nodeVersion: typeof process !== 'undefined' ? process.version : 'unknown',
    },
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
