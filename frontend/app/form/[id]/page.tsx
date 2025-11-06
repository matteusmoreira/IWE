'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Form as FormType, FormField } from '@/lib/form-field-types';

export default function PublicFormPage() {
  const params = useParams();
  const router = useRouter();
  const formId = params.id as string;

  const [form, setForm] = useState<FormType | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [tenants, setTenants] = useState<{ id: string; name: string; slug?: string }[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>('');

  useEffect(() => {
    fetchForm();
  }, [formId]);

  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const response = await fetch('/api/public/tenants');
        const data = await response.json();
        if (response.ok) {
          const list = Array.isArray(data.tenants) ? data.tenants : [];
          setTenants(list);
        } else {
          console.error('Falha ao listar polos');
        }
      } catch (err) {
        console.error('Erro ao carregar polos', err);
      }
    };
    fetchTenants();
  }, []);

  const fetchForm = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/public/forms/${formId}`);
      const data = await response.json();

      if (response.ok) {
        // Se o formulário possui slug, redirecionar para a URL curta
        if (data.form?.slug) {
          router.replace(`/f/${data.form.slug}`);
          return;
        }
        setForm(data.form);
        // Se o formulário estiver vinculado a um polo específico, selecionar automaticamente esse polo
        if (data.form?.tenant_id) {
          setSelectedTenant(data.form?.tenants?.id || data.form.tenant_id);
        }
        // Inicializar formData com valores vazios
        const initialData: Record<string, any> = {};
        data.form.form_fields?.forEach((field: FormField) => {
          initialData[field.name] = field.type === 'checkbox' ? [] : '';
        });
        setFormData(initialData);
      } else {
        setError(data.error || 'Formulário não encontrado');
      }
    } catch (error) {
      console.error('Error fetching form:', error);
      setError('Erro ao carregar formulário');
    } finally {
      setLoading(false);
    }
  };

  const validateField = (field: FormField, value: any): string | null => {
    // Campo obrigatório
    if (field.required && (!value || value === '' || (Array.isArray(value) && value.length === 0))) {
      return 'Este campo é obrigatório';
    }

    if (!value) return null; // Se não tem valor e não é obrigatório, ok

    // Validação de email
    if (field.type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return 'Email inválido';
      }
    }

    // Validação de CPF (máscara + algoritmo)
    if (field.type === 'cpf') {
      const sanitized = String(value || '').replace(/\D/g, '');
      if (sanitized.length !== 11) {
        return 'CPF inválido (11 dígitos)';
      }
      if (!isValidCPF(sanitized)) {
        return 'CPF inválido';
      }
    }

    // Validação de CEP (máscara)
    if (field.type === 'cep') {
      const sanitized = String(value || '').replace(/\D/g, '');
      if (sanitized.length !== 8) {
        return 'CEP inválido (8 dígitos)';
      }
    }

    // Validação de telefone (máscara fixa com 11 dígitos)
    if (field.type === 'phone') {
      const sanitized = String(value || '').replace(/\D/g, '');
      if (sanitized.length !== 11) {
        return 'Telefone inválido (11 dígitos)';
      }
    }

    // Validação de número
    if (field.type === 'number') {
      if (isNaN(Number(value))) {
        return 'Deve ser um número válido';
      }
      if (field.validation_rules?.min !== undefined && Number(value) < field.validation_rules.min) {
        return `Deve ser no mínimo ${field.validation_rules.min}`;
      }
      if (field.validation_rules?.max !== undefined && Number(value) > field.validation_rules.max) {
        return `Deve ser no máximo ${field.validation_rules.max}`;
      }
    }

    // Validação de comprimento de texto
    if (field.type === 'text' || field.type === 'textarea') {
      if (field.validation_rules?.minLength && value.length < field.validation_rules.minLength) {
        return `Deve ter no mínimo ${field.validation_rules.minLength} caracteres`;
      }
      if (field.validation_rules?.maxLength && value.length > field.validation_rules.maxLength) {
        return `Deve ter no máximo ${field.validation_rules.maxLength} caracteres`;
      }
    }

    return null;
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData({ ...formData, [fieldName]: value });
    // Limpar erro de validação ao digitar
    if (validationErrors[fieldName]) {
      setValidationErrors({ ...validationErrors, [fieldName]: '' });
    }
  };

  const handleCheckboxChange = (fieldName: string, optionValue: string, checked: boolean) => {
    const currentValues = formData[fieldName] || [];
    let newValues;
    
    if (checked) {
      newValues = [...currentValues, optionValue];
    } else {
      newValues = currentValues.filter((v: string) => v !== optionValue);
    }
    
    handleFieldChange(fieldName, newValues);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validar todos os campos
    const errors: Record<string, string> = {};
    form?.form_fields?.forEach((field) => {
      const error = validateField(field, formData[field.name]);
      if (error) {
        errors[field.name] = error;
      }
    });

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      // Scroll para o primeiro erro
      const firstErrorField = Object.keys(errors)[0];
      document.getElementById(`field-${firstErrorField}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    // Validar seleção de polo apenas para formulários globais (sem tenant vinculado)
    if (!form?.tenant_id && !selectedTenant) {
      setError('Selecione um polo para enviar seu formulário.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/public/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form_id: formId,
          data: formData,
          // Enviar tenant_id apenas se houver seleção (em formulários globais) ou se o formulário tiver polo vinculado
          ...(selectedTenant ? { tenant_id: selectedTenant } : {}),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Se requer pagamento, criar preferência e redirecionar
        if (data.requires_payment) {
          // Criar preferência de pagamento
          const paymentResponse = await fetch('/api/payments/create-preference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              submission_id: data.submission_id,
            }),
          });

          const paymentData = await paymentResponse.json();

          if (paymentResponse.ok && paymentData.init_point) {
            // Redirecionar para checkout do Mercado Pago
            window.location.href = paymentData.init_point;
            return;
          } else {
            setError('Erro ao processar pagamento. Tente novamente.');
            setSubmitting(false);
            return;
          }
        }

        // Sucesso sem pagamento
        setSubmitted(true);

        if (data.redirect_url) {
          // Redirecionar para URL customizada
          setTimeout(() => {
            window.location.href = data.redirect_url;
          }, 2000);
        }
      } else {
        setError(data.error || 'Erro ao enviar formulário');
        if (data.missing_fields) {
          const errors: Record<string, string> = {};
          data.missing_fields.forEach((fieldName: string) => {
            errors[fieldName] = 'Este campo é obrigatório';
          });
          setValidationErrors(errors);
        }
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      setError('Erro ao enviar formulário. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  // Helpers de máscara/validação
  const formatPhone = (digits: string) => {
    const v = digits.replace(/\D/g, '').slice(0, 11);
    const part1 = v.slice(0, 2);
    const part2 = v.slice(2, 7);
    const part3 = v.slice(7, 11);
    if (v.length <= 2) return `(${part1}`;
    if (v.length <= 7) return `(${part1}) ${part2}`;
    return `(${part1}) ${part2}-${part3}`;
  };

  const formatCPF = (digits: string) => {
    const v = digits.replace(/\D/g, '').slice(0, 11);
    const p1 = v.slice(0, 3);
    const p2 = v.slice(3, 6);
    const p3 = v.slice(6, 9);
    const p4 = v.slice(9, 11);
    if (v.length <= 3) return p1;
    if (v.length <= 6) return `${p1}.${p2}`;
    if (v.length <= 9) return `${p1}.${p2}.${p3}`;
    return `${p1}.${p2}.${p3}-${p4}`;
  };

  const isValidCPF = (cpfDigits: string) => {
    const cpf = cpfDigits.replace(/\D/g, '');
    if (cpf.length !== 11) return false;
    // Elimina CPFs inválidos conhecidos
    if (/^(\d)\1{10}$/.test(cpf)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i)) * (10 - i);
    let rev = 11 - (sum % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cpf.charAt(9))) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i)) * (11 - i);
    rev = 11 - (sum % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cpf.charAt(10))) return false;
    return true;
  };

  const formatCEP = (digits: string) => {
    const v = digits.replace(/\D/g, '').slice(0, 8);
    const p1 = v.slice(0, 5);
    const p2 = v.slice(5, 8);
    if (v.length <= 5) return p1;
    return `${p1}-${p2}`;
  };

  const fillAddressFromCEP = (cepDigits: string) => {
    const sanitized = cepDigits.replace(/\D/g, '');
    if (sanitized.length !== 8) return;
    fetch(`https://viacep.com.br/ws/${sanitized}/json/`)
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.erro) {
          // Mapear campos se existirem no formulário
          const updates: Record<string, any> = {};
          if ('logradouro' in (formData || {})) updates['logradouro'] = data.logradouro || '';
          if ('endereco' in (formData || {})) updates['endereco'] = data.logradouro || '';
          if ('bairro' in (formData || {})) updates['bairro'] = data.bairro || '';
          if ('localidade' in (formData || {})) updates['localidade'] = data.localidade || '';
          if ('cidade' in (formData || {})) updates['cidade'] = data.localidade || '';
          if ('uf' in (formData || {})) updates['uf'] = data.uf || '';
          if ('estado' in (formData || {})) updates['estado'] = data.uf || '';
          if (Object.keys(updates).length > 0) {
            setFormData({ ...formData, ...updates });
          }
        }
      })
      .catch(() => {
        // Silenciar erros de CEP
      });
  };

  const renderField = (field: FormField) => {
    const fieldError = validationErrors[field.name];

    const baseInputClass = `w-full px-3 py-2 border rounded-md ${
      fieldError ? 'border-red-500' : ''
    }`;

    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
      case 'cpf':
      case 'cep':
      case 'number':
        return (
          <div key={field.id} id={`field-${field.name}`} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.name}
              type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'}
              placeholder={field.placeholder || ''}
              value={formData[field.name] || ''}
              onChange={(e) => {
                const raw = e.target.value;
                if (field.type === 'phone') {
                  const masked = formatPhone(raw);
                  handleFieldChange(field.name, masked);
                  return;
                }
                if (field.type === 'cpf') {
                  const masked = formatCPF(raw);
                  handleFieldChange(field.name, masked);
                  return;
                }
                if (field.type === 'cep') {
                  const masked = formatCEP(raw);
                  handleFieldChange(field.name, masked);
                  // Quando completar 8 dígitos, buscar endereço
                  const digits = raw.replace(/\D/g, '');
                  if (digits.length === 8) {
                    fillAddressFromCEP(digits);
                  }
                  return;
                }
                // Padrão
                handleFieldChange(field.name, raw);
              }}
              className={fieldError ? 'border-red-500' : ''}
              required={field.required}
            />
            {fieldError && <p className="text-sm text-red-500">{fieldError}</p>}
          </div>
        );

      case 'textarea':
        return (
          <div key={field.id} id={`field-${field.name}`} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <textarea
              id={field.name}
              placeholder={field.placeholder || ''}
              value={formData[field.name] || ''}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              className={`${baseInputClass} min-h-[100px]`}
              required={field.required}
            />
            {fieldError && <p className="text-sm text-red-500">{fieldError}</p>}
          </div>
        );

      case 'date':
        return (
          <div key={field.id} id={`field-${field.name}`} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.name}
              type="date"
              value={formData[field.name] || ''}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              className={fieldError ? 'border-red-500' : ''}
              required={field.required}
            />
            {fieldError && <p className="text-sm text-red-500">{fieldError}</p>}
          </div>
        );

      case 'select':
        return (
          <div key={field.id} id={`field-${field.name}`} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <select
              id={field.name}
              value={formData[field.name] || ''}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              className={baseInputClass}
              required={field.required}
            >
              <option value="">{field.placeholder || 'Selecione uma opção'}</option>
              {field.options?.map((option, idx) => (
                <option key={idx} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {fieldError && <p className="text-sm text-red-500">{fieldError}</p>}
          </div>
        );

      case 'radio':
        return (
          <div key={field.id} id={`field-${field.name}`} className="space-y-2">
            <Label>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <div className="space-y-2">
              {field.options?.map((option, idx) => (
                <label key={idx} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={field.name}
                    value={option.value}
                    checked={formData[field.name] === option.value}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    required={field.required}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
            {fieldError && <p className="text-sm text-red-500">{fieldError}</p>}
          </div>
        );

      case 'checkbox':
        return (
          <div key={field.id} id={`field-${field.name}`} className="space-y-2">
            <Label>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <div className="space-y-2">
              {field.options?.map((option, idx) => (
                <label key={idx} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    value={option.value}
                    checked={(formData[field.name] || []).includes(option.value)}
                    onChange={(e) => handleCheckboxChange(field.name, option.value, e.target.checked)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
            {fieldError && <p className="text-sm text-red-500">{fieldError}</p>}
          </div>
        );

      case 'file':
        return (
          <div key={field.id} id={`field-${field.name}`} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.name}
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFieldChange(field.name, file.name);
                  // TODO: Implementar upload real
                }
              }}
              className={fieldError ? 'border-red-500' : ''}
              required={field.required}
            />
            {fieldError && <p className="text-sm text-red-500">{fieldError}</p>}
            <p className="text-xs text-muted-foreground">
              Upload de arquivos será implementado em breve
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-brand-primary/10 to-brand-accent/10">
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-brand-primary/10 to-brand-accent/10 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Erro</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-brand-primary/10 to-brand-accent/10 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Formulário Enviado!</h2>
            <p className="text-muted-foreground">
              {form?.settings?.success_message || 'Seu formulário foi enviado com sucesso.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-primary/10 to-brand-accent/10 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            {/* Logo centralizada no topo */}
            <div className="flex justify-center mb-4">
              <Image src="/logo.png" alt="Logo IWE" width={64} height={64} className="rounded-full" />
            </div>
            {form?.tenants?.name && (
              <p className="text-center text-sm text-muted-foreground">{form.tenants.name}</p>
            )}
            <CardTitle className="text-3xl text-center">{form?.name}</CardTitle>
            {form?.description && (
              <CardDescription className="text-base mt-2 text-center">{form.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-600">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="tenant_id">
                  {form?.tenant_id ? 'Polo' : 'Polo *'}
                </Label>
                <select
                  id="tenant_id"
                  value={selectedTenant}
                  onChange={(e) => setSelectedTenant(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-md"
                  disabled={!!form?.tenant_id}
                  required={!form?.tenant_id}
                >
                  {!form?.tenant_id && (
                    <option value="">Selecione um polo</option>
                  )}
                  {form?.tenant_id ? (
                    <option value={selectedTenant}>{form?.tenants?.name || 'Polo vinculado'}</option>
                  ) : (
                    tenants.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))
                  )}
                </select>
                {!form?.tenant_id && !selectedTenant && (
                  <p className="text-xs text-muted-foreground">Você deve escolher um polo antes de enviar.</p>
                )}
              </div>
              {form?.form_fields?.map((field) => renderField(field))}

              <div className="flex gap-4 pt-4">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-brand-primary hover:bg-brand-primary/90"
                >
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enviar Formulário
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Instituto Wesleyano de Educação.
        </p>
      </div>
    </div>
  );
}
