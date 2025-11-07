'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Form as FormType, FormField } from '@/lib/form-field-types';
import { formatPhone, formatCEP, formatCPF } from '@/lib/masks';
import { FileUpload } from '@/components/ui/file-upload';
import { toast } from 'sonner';

export default function PublicFormBySlugPage() {
  const params = useParams();
  const formSlug = params.slug as string;

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
  }, [formSlug]);

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
      const response = await fetch(`/api/public/forms/by-slug/${formSlug}`);
      const data = await response.json();

      if (response.ok) {
        setForm(data.form);
        // Seleciona automaticamente o polo se o form estiver vinculado a um
        if (data.form?.tenant_id) {
          setSelectedTenant(data.form?.tenants?.id || data.form.tenant_id);
        }
        // Inicializa formData
        const initialData: Record<string, any> = {};
        data.form.form_fields?.forEach((field: FormField) => {
          // checkbox de múltipla seleção começa como array vazio;
          // accept (checkbox único de aceite) começa como boolean false;
          // demais tipos começam como string vazia.
          if (field.type === 'checkbox') {
            initialData[field.name] = [];
          } else if (field.type === 'accept') {
            initialData[field.name] = false;
          } else {
            initialData[field.name] = '';
          }
        });
        setFormData(initialData);
      } else {
        setError(data.error || 'Formulário não encontrado');
      }
    } catch (error) {
      console.error('Error fetching form by slug:', error);
      setError('Erro ao carregar formulário');
    } finally {
      setLoading(false);
    }
  };

  // Formatar valor em BRL
  const formatBRL = (value: number) => {
    try {
      return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    } catch {
      return `R$ ${Number(value).toFixed(2)}`;
    }
  };

  const validateField = (field: FormField, value: any): string | null => {
    // Regra específica para campo de aceite (checkbox único)
    if (field.type === 'accept') {
      if (field.required && value !== true) {
        return 'Você precisa marcar o aceite para continuar';
      }
      return null;
    }

    if (field.required && (!value || value === '' || (Array.isArray(value) && value.length === 0))) {
      return 'Este campo é obrigatório';
    }
    if (!value) return null;
    if (field.type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) return 'Email inválido';
    }
    if (field.type === 'cpf') {
      const cpfRegex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
      if (!cpfRegex.test(value)) return 'CPF inválido (use o formato 000.000.000-00)';
    }
    if (field.type === 'cep') {
      const cepRegex = /^\d{5}-\d{3}$/;
      if (!cepRegex.test(value)) return 'CEP inválido (use o formato 00000-000)';
    }
    if (field.type === 'phone') {
      const phoneRegex = /^\(\d{2}\)\s?\d{4,5}-?\d{4}$/;
      if (!phoneRegex.test(value)) return 'Telefone inválido (use o formato (00) 00000-0000)';
    }
    if (field.type === 'number') {
      if (isNaN(Number(value))) return 'Deve ser um número válido';
      if (field.validation_rules?.min !== undefined && Number(value) < field.validation_rules.min) {
        return `Deve ser no mínimo ${field.validation_rules.min}`;
      }
      if (field.validation_rules?.max !== undefined && Number(value) > field.validation_rules.max) {
        return `Deve ser no máximo ${field.validation_rules.max}`;
      }
    }
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
    if (validationErrors[fieldName]) {
      setValidationErrors({ ...validationErrors, [fieldName]: '' });
    }
  };

  const handleCheckboxChange = (fieldName: string, optionValue: string, checked: boolean) => {
    const currentValues = formData[fieldName] || [];
    let newValues;
    newValues = checked ? [...currentValues, optionValue] : currentValues.filter((v: string) => v !== optionValue);
    handleFieldChange(fieldName, newValues);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const errors: Record<string, string> = {};
    form?.form_fields?.forEach((field) => {
      const err = validateField(field, formData[field.name]);
      if (err) errors[field.name] = err;
    });
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      const firstErrorField = Object.keys(errors)[0];
      document.getElementById(`field-${firstErrorField}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
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
          form_id: form?.id, // usa ID real para submissão
          data: formData,
          ...(selectedTenant ? { tenant_id: selectedTenant } : {}),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.requires_payment) {
          const paymentResponse = await fetch('/api/payments/create-preference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ submission_id: data.submission_id }),
          });
          const paymentData = await paymentResponse.json();
          if (paymentResponse.ok && paymentData.init_point) {
            window.location.href = paymentData.init_point;
            return;
          } else {
            // Exibir mensagem detalhada vinda do backend quando disponível
            const composedMsg = (() => {
              const base = paymentData?.error || 'Erro ao processar pagamento. Tente novamente.';
              const reason = paymentData?.reason ? ` (${paymentData.reason})` : '';
              const detail = paymentData?.detail ? `: ${paymentData.detail}` : '';
              const meta = paymentData?.meta?.blocked_by || paymentData?.meta?.code
                ? ` [${[paymentData?.meta?.code, paymentData?.meta?.blocked_by].filter(Boolean).join(' - ')}]`
                : '';
              return `${base}${reason}${detail}${meta}`;
            })();

            console.error('Payment preference error:', paymentData);
            setError(composedMsg);
            setSubmitting(false);
            return;
          }
        }
        setSubmitted(true);
        if (data.redirect_url) {
          setTimeout(() => { window.location.href = data.redirect_url; }, 2000);
        }
      } else {
        setError(data.error || 'Erro ao enviar formulário');
        if (data.missing_fields) {
          const errMap: Record<string, string> = {};
          data.missing_fields.forEach((fieldName: string) => { errMap[fieldName] = 'Este campo é obrigatório'; });
          setValidationErrors(errMap);
        }
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      setError('Erro ao enviar formulário. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  // Máscaras centralizadas em '@/lib/masks'

  // Helpers de arquivo
  const computeAccept = (fileTypes?: string[]) => {
    // Padrão restrito aos tipos solicitados
    if (!fileTypes || fileTypes.length === 0) return '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp';
    const map: Record<string, string> = {
      // 'image' mapeia apenas para os formatos permitidos
      image: '.png,.jpg,.jpeg,.webp',
      pdf: '.pdf',
      doc: '.doc',
      docx: '.docx',
      xls: '.xls',
      xlsx: '.xlsx',
      csv: '.csv',
      png: '.png',
      jpg: '.jpg',
      jpeg: '.jpeg',
      webp: '.webp',
    };
    return fileTypes.map((t) => map[t] || `.${t}`).join(',');
  };

  const uploadFile = async (fieldName: string, file: File | null) => {
    // Remoção: ao clicar em remover no FileUpload, apagamos do storage (se houver) antes de limpar
    if (!file) {
      try {
        const current = formData[fieldName] as any;
        const storagePath = current?.storagePath;
        if (storagePath) {
          const res = await fetch(`/api/public/upload/delete?path=${encodeURIComponent(storagePath)}`, { method: 'DELETE' });
          if (!res.ok) {
            toast.error('Falha ao remover arquivo do storage.');
            return; // mantém o valor para tentativa futura
          }
          toast.success('Arquivo removido do storage.');
        }
        // Sem storagePath, apenas limpamos localmente
        handleFieldChange(fieldName, '');
      } catch (err) {
        console.error('Delete error', err);
        toast.error('Erro ao remover arquivo do storage.');
        return; // mantém valor atual
      }
      return;
    }

    const tenantId = selectedTenant || form?.tenant_id || form?.tenants?.id;
    if (!tenantId) {
      toast.error('Selecione um polo antes de enviar o arquivo.');
      handleFieldChange(fieldName, { name: file.name, size: file.size, type: file.type });
      return;
    }

    try {
      // 1) Solicita URL assinada para upload (público, sem login)
      const initRes = await fetch('/api/public/upload/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldName,
          tenantId,
          fileName: file.name,
          fileType: file.type,
        }),
      });
      const initData = await initRes.json();
      if (!initRes.ok || !initData?.uploadUrl || !initData?.storagePath) {
        toast.error(initData?.error || 'Falha ao preparar upload. Metadados locais foram salvos.');
        handleFieldChange(fieldName, { name: file.name, size: file.size, type: file.type });
        return;
      }

      const uploadUrl = initData.uploadUrl as string;
      const storagePath = initData.storagePath as string;

      // 2) Faz upload direto para a URL assinada (PUT)
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
          'x-upsert': 'false',
        },
        body: file,
      });

      if (!putRes.ok) {
        toast.error('Falha no upload para o storage. Metadados locais foram salvos.');
        handleFieldChange(fieldName, { name: file.name, size: file.size, type: file.type });
        return;
      }

      // 3) Gera URL assinada de visualização (7 dias)
      let viewUrl: string | undefined = undefined;
      try {
        const viewRes = await fetch(`/api/public/upload/signed-url?path=${encodeURIComponent(storagePath)}&format=json`);
        const viewData = await viewRes.json();
        if (viewRes.ok && viewData?.signedUrl) {
          viewUrl = viewData.signedUrl as string;
        }
      } catch (e) {
        // Apenas ignora; visualização pode ser carregada depois
        console.warn('Falha ao gerar URL de visualização assinada', e);
      }

      // 4) Atualiza o campo com metadados e URL (se disponível)
      handleFieldChange(fieldName, {
        name: file.name,
        size: file.size,
        type: file.type,
        url: viewUrl,
        storagePath,
      });
      toast.success('Arquivo enviado com sucesso.');
    } catch (err) {
      console.error('Upload error', err);
      toast.error('Erro ao enviar arquivo. Metadados locais foram mantidos.');
      handleFieldChange(fieldName, { name: file.name, size: file.size, type: file.type });
    }
  };


  const renderField = (field: FormField) => {
    const fieldError = validationErrors[field.name];
    const baseInputClass = `w-full px-3 py-2 border rounded-md ${fieldError ? 'border-red-500' : ''}`;
    
    switch (field.type) {
      case 'text':
      case 'email':
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
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              className={fieldError ? 'border-red-500' : ''}
              required={field.required}
            />
            {fieldError && <p className="text-sm text-red-500">{fieldError}</p>}
          </div>
        );
        
      case 'phone':
        return (
          <div key={field.id} id={`field-${field.name}`} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.name}
              type="text"
              placeholder={field.placeholder || '(00) 00000-0000'}
              value={formData[field.name] || ''}
              onChange={(e) => {
                const formatted = formatPhone(e.target.value);
                handleFieldChange(field.name, formatted);
              }}
              className={fieldError ? 'border-red-500' : ''}
              required={field.required}
              maxLength={15}
            />
            {fieldError && <p className="text-sm text-red-500">{fieldError}</p>}
          </div>
        );
        
      case 'cep':
        return (
          <div key={field.id} id={`field-${field.name}`} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.name}
              type="text"
              placeholder={field.placeholder || '00000-000'}
              value={formData[field.name] || ''}
              onChange={(e) => {
                const formatted = formatCEP(e.target.value);
                handleFieldChange(field.name, formatted);
              }}
              className={fieldError ? 'border-red-500' : ''}
              required={field.required}
              maxLength={9}
            />
            {fieldError && <p className="text-sm text-red-500">{fieldError}</p>}
          </div>
        );
      case 'cpf':
        return (
          <div key={field.id} id={`field-${field.name}`} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.name}
              type="text"
              placeholder={field.placeholder || '000.000.000-00'}
              value={formData[field.name] || ''}
              onChange={(e) => {
                const formatted = formatCPF(e.target.value);
                handleFieldChange(field.name, formatted);
              }}
              className={fieldError ? 'border-red-500' : ''}
              required={field.required}
              maxLength={14}
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
              {field.options?.map((option, idx) => {
                const optLabel = typeof option === 'string' ? option : option.label;
                const optValue = typeof option === 'string' ? option : option.value;
                return (
                  <option key={idx} value={optValue}>{optLabel}</option>
                );
              })}
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
              {field.options?.map((option, idx) => {
                const optLabel = typeof option === 'string' ? option : option.label;
                const optValue = typeof option === 'string' ? option : option.value;
                return (
                  <label key={idx} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={field.name}
                      value={optValue}
                      checked={formData[field.name] === optValue}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      required={field.required}
                    />
                    <span>{optLabel}</span>
                  </label>
                );
              })}
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
              {field.options?.map((option, idx) => {
                const optLabel = typeof option === 'string' ? option : option.label;
                const optValue = typeof option === 'string' ? option : option.value;
                return (
                  <label key={idx} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      value={optValue}
                      checked={(formData[field.name] || []).includes(optValue)}
                      onChange={(e) => handleCheckboxChange(field.name, optValue, e.target.checked)}
                    />
                    <span>{optLabel}</span>
                  </label>
                );
              })}
            </div>
            {fieldError && <p className="text-sm text-red-500">{fieldError}</p>}
          </div>
        );

      case 'accept':
        return (
          <div key={field.id} id={`field-${field.name}`} className="space-y-1">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(formData[field.name])}
                onChange={(e) => handleFieldChange(field.name, e.target.checked)}
              />
              <span>
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </span>
            </label>
            {field.placeholder && (
              <p className="text-xs text-muted-foreground">{field.placeholder}</p>
            )}
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
            <FileUpload
              accept={computeAccept(field.validation_rules?.fileTypes)}
              maxSize={field.validation_rules?.maxFileSize ?? 10 * 1024 * 1024}
              value={formData[field.name]?.url}
              disabled={submitting}
              showPreview={false}
              onFileSelect={(file) => uploadFile(field.name, file)}
            />
            {fieldError && <p className="text-sm text-red-500">{fieldError}</p>}
            <p className="text-xs text-muted-foreground">O arquivo é enviado automaticamente ao selecionar. Se o upload falhar, salvamos metadados para tentar novamente.</p>
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
            <p className="text-muted-foreground">{form?.settings?.success_message || 'Seu formulário foi enviado com sucesso.'}</p>
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
        <Image src="/logo.png" alt="Logo IWE" width={64} height={64} className="rounded-full" style={{ height: 'auto', width: 'auto' }} />
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

            {form?.settings?.require_payment && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-yellow-800">
                  Este formulário possui taxa de {formatBRL(Number(form?.settings?.payment_amount ?? 0))}.
                  Você será redirecionado para o pagamento após o envio.
                </p>
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
                <Button type="submit" disabled={submitting} className="w-full bg-brand-primary hover:bg-brand-primary/90">
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enviar Formulário
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">Instituto Wesleyano de Educação.</p>
      </div>
    </div>
  );
}