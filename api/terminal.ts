export const config = {
  runtime: 'nodejs',
};

/**
 * Endpoint de segurança do Terminal.
 * A execução de comandos no servidor via child_process.exec foi removida para eliminar
 * riscos de RCE e garantir funcionamento Serverless na Vercel.
 * Os comandos são emulados de forma segura no cliente via API do GitHub (Octokit).
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido.' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const command = (body.command || '').trim();

    return new Response(
      JSON.stringify({
        command,
        stdout: '',
        stderr: 'O terminal do Synap opera no modo Emulador Git seguro via API do GitHub.',
        exitCode: 0,
        executionTimeMs: 1,
        success: true,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: err?.message || 'Erro ao processar requisição no terminal.',
        exitCode: 1,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
