import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR').format(d);
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

export function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

// Substituir 'any' por 'unknown' para atender @typescript-eslint/no-explicit-any
export function parseTemplateVariables(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return (data as Record<string, unknown>)[key] !== undefined
      ? String((data as Record<string, unknown>)[key])
      : match;
  });
}

// -----------------------------
// Utilidades de exibição (labels/valores)
// -----------------------------

// Converte texto para "Title Case" respeitando espaços
export function toTitleCase(text: string): string {
  return text
    .toLowerCase()
    .split(' ')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ''))
    .join(' ');
}

// Normaliza labels vindos com underscore (ex: "anos_metodista" -> "Anos Metodista")
export function formatDisplayLabel(key: string): string {
  const spaced = key.replace(/_/g, ' ').trim();
  return toTitleCase(spaced);
}

// Detecta padrão de data ISO simples (YYYY-MM-DD)
function isIsoDateYYYYMMDD(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// Normaliza valores para exibição:
// - booleano -> "Verdadeiro/Falso"
// - strings com underscore -> substitui por espaço e aplica Title Case
// - datas no formato YYYY-MM-DD -> DD/MM/AAAA
// - arrays -> itens separados por vírgula aplicando a mesma regra
export function formatDisplayValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((v) => formatDisplayValue(v)).join(', ');
  }

  if (typeof value === 'boolean') {
    return value ? 'Verdadeiro' : 'Falso';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Trata strings booleanas
    if (trimmed.toLowerCase() === 'true') return 'Verdadeiro';
    if (trimmed.toLowerCase() === 'false') return 'Falso';

    // Data ISO simples
    if (isIsoDateYYYYMMDD(trimmed)) {
      // Usa Intl para garantir locale BR
      return formatDate(trimmed);
    }

    // Substitui underscores e aplica Title Case
    return toTitleCase(trimmed.replace(/_/g, ' '));
  }

  // Fallback
  return value != null ? String(value) : '';
}

// Aplica regras especiais baseadas no nome do campo
export function formatDisplayValueByKey(key: string, value: unknown): string {
  const k = (key || '').toLowerCase();
  const isPhone = ['whatsapp', 'telefone', 'phone', 'celular'].some((p) => k.includes(p));
  if (isPhone) {
    if (typeof value === 'string') return formatPhone(value);
    return formatDisplayValue(value);
  }
  // Especial: campo "anos_metodista" deve manter exatamente o texto informado no formulário
  if (k.includes('anos_metodista')) {
    if (typeof value === 'string') {
      // Apenas substitui underscores por espaço, sem Title Case
      return value.replace(/_/g, ' ').trim();
    }
    return formatDisplayValue(value);
  }
  return formatDisplayValue(value);
}
