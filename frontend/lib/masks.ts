// Util compartilhado de máscaras para inputs
// Mantém consistência entre páginas e componentes

// Remove todos os caracteres não numéricos
export function unmaskDigits(value: string): string {
  return (value || '').replace(/\D/g, '');
}

// Máscara de CPF: 000.000.000-00
export function formatCPF(value: string): string {
  const numbers = unmaskDigits(value).slice(0, 11);
  const parts: string[] = [];
  if (numbers.length > 0) parts.push(numbers.slice(0, 3));
  if (numbers.length > 3) parts.push(numbers.slice(3, 6));
  if (numbers.length > 6) parts.push(numbers.slice(6, 9));
  const rest = numbers.slice(9, 11);
  const main = parts.join('.');
  return rest ? `${main}-${rest}` : main;
}

// Máscara de CEP: 00000-000
export function formatCEP(value: string): string {
  const numbers = unmaskDigits(value).slice(0, 8);
  if (numbers.length <= 5) return numbers;
  return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`;
}

// Máscara de Telefone BR: (00) 00000-0000 ou (00) 0000-0000
export function formatPhone(value: string): string {
  const numbers = unmaskDigits(value).slice(0, 11);
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  if (numbers.length <= 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6, 10)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
}

// Máscara de RG: 00.000.000-0 (formato comum; pode variar por estado)
export function formatRG(value: string): string {
  const numbers = unmaskDigits(value).slice(0, 10);
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 5) return `${numbers.slice(0, 2)}.${numbers.slice(2)}`;
  if (numbers.length <= 8) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`;
  return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}-${numbers.slice(8)}`;
}

// Validações simples
export const validators = {
  cpf: (value: string) => /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(value),
  cep: (value: string) => /^\d{5}-\d{3}$/.test(value),
  email: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  phone: (value: string) => /^\(\d{2}\)\s?\d{4,5}-?\d{4}$/.test(value),
};