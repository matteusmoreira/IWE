// Rate limiting simples baseado em IP e endpoint
const requests = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT = 100; // requests per window
const RATE_WINDOW = 60 * 1000; // 1 minute in milliseconds

function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip');
  return ip || 'unknown';
}

function getRateLimitKey(req: Request): string {
  const ip = getClientIp(req);
  const url = new URL(req.url);
  return `${ip}:${url.pathname}`;
}

export function checkRateLimit(req: Request): { allowed: boolean; remaining: number } {
  const key = getRateLimitKey(req);
  const now = Date.now();
  
  const current = requests.get(key);
  
  if (!current || now > current.resetTime) {
    // Reset or new entry
    requests.set(key, { count: 1, resetTime: now + RATE_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }
  
  if (current.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  
  current.count++;
  return { allowed: true, remaining: RATE_LIMIT - current.count };
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of requests.entries()) {
    if (now > value.resetTime) {
      requests.delete(key);
    }
  }
}, RATE_WINDOW);