export const config = {
  runtime: 'nodejs',
};

export default async function handler(req: Request): Promise<Response> {
  let prompt = '';
  let aspectRatio = '1:1';

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      prompt = body.prompt || '';
      aspectRatio = body.aspect_ratio || '1:1';
    } catch {}
  } else {
    const url = new URL(req.url);
    prompt = url.searchParams.get('prompt') || '';
    aspectRatio = url.searchParams.get('aspect_ratio') || '1:1';
  }

  if (!prompt.trim()) {
    return new Response(JSON.stringify({ error: 'Prompt não fornecido para geração de imagem.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Dimensões otimizadas para alta qualidade e carregamento ultrarrápido
  let width = 768;
  let height = 768;

  if (aspectRatio === '16:9') {
    width = 1024;
    height = 576;
  } else if (aspectRatio === '9:16') {
    width = 576;
    height = 1024;
  } else if (aspectRatio === '4:3') {
    width = 800;
    height = 600;
  }

  const seed = Math.floor(Math.random() * 10000000);
  const cleanPrompt = prompt.trim();

  // Endpoint do Pollinations com modelo FLUX (Black Forest Labs - alta qualidade estética)
  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
    cleanPrompt
  )}?width=${width}&height=${height}&model=flux&nologo=true&seed=${seed}`;

  // Aguarda a geração real da imagem na GPU antes de finalizar
  // Faz polling até a Pollinations devolver uma imagem válida (não um erro)
  let imageReady = false;
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const checkRes = await fetch(imageUrl, {
        headers: { 'User-Agent': 'SynapAI/1.0' },
        signal: AbortSignal.timeout(15000),
      });

      if (checkRes.ok) {
        const contentType = checkRes.headers.get('content-type') || '';
        const contentLength = parseInt(checkRes.headers.get('content-length') || '0', 10);

        // Pollinations retorna image/jpeg quando pronto, ou text/html quando ainda gerando
        if (contentType.startsWith('image/') && (contentLength === 0 || contentLength > 1000)) {
          imageReady = true;
          break;
        }
      }

      // Se não tá pronto, espera 2s e tenta de novo
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (err) {
      console.warn(`Tentativa ${attempt + 1} falhou:`, err);
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  if (!imageReady) {
    console.warn('Pollinations não respondeu em tempo hábil. Retornando URL mesmo assim (cliente fará polling).');
  }

  return new Response(
    JSON.stringify({
      success: true,
      url: imageUrl,
      prompt: cleanPrompt,
      dimensions: { width, height },
      aspect_ratio: aspectRatio,
      provider: 'FLUX (Black Forest Labs)',
      markdown: `![${cleanPrompt.replace(/[\n\r]+/g, ' ')}](${imageUrl})`,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
