const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS_PER_MINUTE = 30;

export const ALLOWED_MODELS = [
  'z-ai/glm-5.3',
  'z-ai/glm-5.3-flash',
  'moonshotai/kimi-k3'
];

export function getClientIp(req: Request): string {
  // O Express Server (adaptador local) pode não injetar x-forwarded-for por padrão a menos que configurado,
  // mas o Vercel Edge sempre provê esses cabeçalhos.
  return req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
}

export function checkAuthAndRateLimit(req: Request): Response | null {
  // 1. Auth Check (Só barra se a variável estiver definida no ambiente, permitindo uso local sem chave se desejado,
  // porém na Vercel DEVEMOS definir SYNAP_API_SECRET para ativar a proteção).
  const expectedSecret = process.env.SYNAP_API_SECRET;
  
  if (expectedSecret && expectedSecret.trim() !== '') {
    const providedKey = req.headers.get('x-api-key');
    if (!providedKey || providedKey !== expectedSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Chave de API inválida ou ausente (x-api-key)' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // 2. Rate Limit Check Simples
  const ip = getClientIp(req);
  if (ip !== 'unknown') {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    
    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(ip, { count: 1, resetAt: now + 60000 }); // reseta em 60s
    } else {
      entry.count += 1;
      if (entry.count > MAX_REQUESTS_PER_MINUTE) {
        return new Response(JSON.stringify({ error: 'Too Many Requests: Limite atingido' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '60' }
        });
      }
    }
  }

  return null; // OK
}
