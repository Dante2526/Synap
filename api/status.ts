export const config = {
  runtime: 'edge',
};

export default async function handler() {
  const rawKey = process.env.NVIDIA_API_KEY || '';
  const isPlaceholder = rawKey === 'sua_key_aqui' || rawKey === 'nvapi-your-key-here' || rawKey.trim() === '';

  return new Response(
    JSON.stringify({
      status: 'ok',
      hasApiKey: !isPlaceholder,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
