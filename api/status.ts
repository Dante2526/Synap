export const config = {
  runtime: 'edge',
};

export default async function handler() {
  const rawKey = process.env.NVIDIA_API_KEY || '';
  const isPlaceholder = rawKey === 'sua_key_aqui' || rawKey === 'nvapi-your-key-here' || rawKey.trim() === '';

  const rawGemini = process.env.GEMINI_API_KEY || '';
  const isGeminiPlaceholder = rawGemini === 'MY_GEMINI_API_KEY' || rawGemini.trim() === '';

  return new Response(
    JSON.stringify({
      status: 'ok',
      hasApiKey: !isPlaceholder,
      hasGeminiKey: !isGeminiPlaceholder,
      hasEdgeTts: true,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
