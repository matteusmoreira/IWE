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
      // Remove objetos complexos não esperados
      sanitized[key] = null;
    }
  }
  
  return sanitized;
}