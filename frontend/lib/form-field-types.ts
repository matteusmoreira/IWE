// Tipos de campos disponíveis no Form Builder
export const FIELD_TYPES = [
  {
    value: 'text',
    label: 'Texto Curto',
    icon: 'Type',
    description: 'Campo de texto de uma linha',
  },
  {
    value: 'textarea',
    label: 'Texto Longo',
    icon: 'AlignLeft',
    description: 'Campo de texto de múltiplas linhas',
  },
  {
    value: 'email',
    label: 'Email',
    icon: 'Mail',
    description: 'Campo para endereço de email',
  },
  {
    value: 'phone',
    label: 'Telefone',
    icon: 'Phone',
    description: 'Campo para número de telefone',
  },
  {
    value: 'number',
    label: 'Número',
    icon: 'Hash',
    description: 'Campo numérico',
  },
  {
    value: 'date',
    label: 'Data',
    icon: 'Calendar',
    description: 'Seletor de data',
  },
  {
    value: 'select',
    label: 'Seleção Única',
    icon: 'List',
    description: 'Lista suspensa com uma opção',
  },
  {
    value: 'radio',
    label: 'Múltipla Escolha',
    icon: 'Circle',
    description: 'Botões de rádio para uma opção',
  },
  {
    value: 'checkbox',
    label: 'Caixa de Seleção',
    icon: 'CheckSquare',
    description: 'Múltiplas seleções possíveis',
  },
  {
    value: 'file',
    label: 'Arquivo',
    icon: 'Upload',
    description: 'Upload de arquivo',
  },
  {
    value: 'cpf',
    label: 'CPF',
    icon: 'CreditCard',
    description: 'Campo para CPF (com máscara)',
  },
  {
    value: 'cep',
    label: 'CEP',
    icon: 'MapPin',
    description: 'Campo para CEP (com máscara)',
  },
] as const;

export type FieldType = typeof FIELD_TYPES[number]['value'];

export interface FormField {
  id?: string;
  label: string;
  name: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  validation_rules?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    fileTypes?: string[];
    maxFileSize?: number;
  };
  order_index: number;
  is_active: boolean;
}

export interface Form {
  id: string;
  tenant_id: string;
  slug?: string;
  name: string;
  description?: string;
  is_active: boolean;
  settings: {
    success_message?: string;
    redirect_url?: string;
    allow_multiple_submissions?: boolean;
    require_payment?: boolean;
    payment_amount?: number;
  };
  created_at: string;
  updated_at: string;
  form_fields?: FormField[];
  tenants?: {
    id: string;
    name: string;
    slug: string;
  };
}

// Função para gerar um name válido a partir do label
export function generateFieldName(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9]+/g, '_') // Substitui caracteres especiais por _
    .replace(/^_+|_+$/g, ''); // Remove _ no início e fim
}

// Função para validar se um campo tem opções
export function fieldRequiresOptions(type: FieldType): boolean {
  return ['select', 'radio', 'checkbox'].includes(type);
}

// Função para obter placeholder padrão por tipo
export function getDefaultPlaceholder(type: FieldType): string {
  const placeholders: Record<FieldType, string> = {
    text: 'Digite aqui...',
    textarea: 'Digite seu texto aqui...',
    email: 'exemplo@email.com',
    phone: '(11) 99999-9999',
    number: '0',
    date: 'dd/mm/aaaa',
    select: 'Selecione uma opção',
    radio: '',
    checkbox: '',
    file: 'Clique para selecionar arquivo',
    cpf: '000.000.000-00',
    cep: '00000-000',
  };
  return placeholders[type] || '';
}
