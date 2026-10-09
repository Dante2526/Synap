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

  // Endpoint do Pollinations com modelo turbo (Stable Diffusion Turbo - ultra rápido, gera em 1 a 2s)
  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
    cleanPrompt
  )}?width=${width}&height=${height}&model=turbo&nologo=true&seed=${seed}`;

  // Aguarda a geração real da imagem na GPU antes de finalizar a ferramenta!
  // Dessa forma, o orbe "shaping" (Criando a imagem…) permanece ativo na tela
  // enquanto a imagem está sendo renderizada. Ao concluir, a imagem já está pronta no cache CDN.
  try {
    await fetch(imageUrl, {
      headers: { 'User-Agent': 'SynapAI/1.0' },
      signal: AbortSignal.timeout(12000),
    });
  } catch (err) {
    console.warn('Pré-carregamento da imagem timeout/erro:', err);
  }

  return new Response(
    JSON.stringify({
      success: true,
      url: imageUrl,
      prompt: cleanPrompt,
      dimensions: { width, height },
      aspect_ratio: aspectRatio,
      provider: 'Stable Diffusion Turbo',
      markdown: `![${cleanPrompt.replace(/[\n\r]+/g, ' ')}](${imageUrl})`,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
