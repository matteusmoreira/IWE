// Validação básica de input para segurança
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove tags HTML básicas
    .slice(0, 1000); // Limita tamanho
}

export function sanitizeEmail(email: string): string {
  const sanitized = sanitizeInput(email);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(sanitized) ? sanitized : '';
}

export function sanitizePhone(phone: string): string {
  const sanitized = sanitizeInput(phone);
  return sanitized.replace(/\D/g, '').slice(0, 15); // Apenas números
}

export function sanitizeSlug(slug: string): string {
  const sanitized = sanitizeInput(slug);
  return sanitized
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-') // Remove caracteres especiais
    .replace(/-+/g, '-') // Remove múltiplos traços
    .replace(/^-|-$/g, ''); // Remove traços no início/fim
}

export function validateFormData(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (typeof value === 'number') {
      sanitized[key] = value;
    } else if (typeof value === 'boolean') {
      sanitized[key] = value;
    } else if (value === null || value === undefined) {
      sanitized[key] = value;
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeInput(item) : item
      );
    } else {
      // Permitir objetos simples usados por campos de arquivo
      const isPlainObject = Object.prototype.toString.call(value) === '[object Object]';
      if (isPlainObject) {
        const v = value as Record<string, unknown>;
        const allowedKeys = new Set(['name', 'size', 'type', 'url', 'storagePath']);
        const result: Record<string, unknown> = {};
        for (const [k, val] of Object.entries(v)) {
          if (!allowedKeys.has(k)) continue;
          if (typeof val === 'string') result[k] = sanitizeInput(val);
          else if (typeof val === 'number') result[k] = val;
          else if (val === null || val === undefined) result[k] = val;
        }
        // Se pelo menos 'name' existir, manter; caso contrário, descartar
        if (typeof result.name === 'string' && result.name.trim() !== '') {
          sanitized[key] = result;
        } else {
          sanitized[key] = null;
        }
      } else {
        sanitized[key] = null;
      }
    }
  }
  
  return sanitized;
}