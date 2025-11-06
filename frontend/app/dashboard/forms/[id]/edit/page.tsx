'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Trash2, 
  GripVertical, 
  Loader2, 
  Save, 
  ArrowLeft,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  FIELD_TYPES, 
  FormField, 
  generateFieldName, 
  fieldRequiresOptions,
  getDefaultPlaceholder 
} from '@/lib/form-field-types';

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

export default function EditFormPage() {
  const params = useParams();
  const formId = params.id as string;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);

  // Form data
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [selectedTenant, setSelectedTenant] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [requiresPayment, setRequiresPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);

  // Field being edited
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [fieldEditorData, setFieldEditorData] = useState<Partial<FormField>>({});

  useEffect(() => {
    Promise.all([fetchTenants(), fetchForm()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId]);

  const fetchTenants = async () => {
    try {
      const response = await fetch('/api/tenants');
      const data = await response.json();
      if (response.ok) {
        setTenants(data.tenants || []);
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
      toast.error('Erro ao carregar polos');
    }
  };

  const fetchForm = async () => {
    try {
      const response = await fetch(`/api/forms/${formId}`);
      const data = await response.json();
      
      if (response.ok && data.form) {
        const form = data.form;
        setFormTitle(form.name);
        setFormDescription(form.description || '');
        setSelectedTenant(form.tenant_id || '');
        setIsActive(form.is_active);
        // Ler configurações de pagamento do objeto settings
        const requirePayment = form.settings?.require_payment ?? false;
        const paymentAmt = form.settings?.payment_amount ?? null;
        setRequiresPayment(Boolean(requirePayment));
        setPaymentAmount(paymentAmt != null ? String(paymentAmt) : '');
        // Carregar campos corretos (form_fields)
        setFields(form.form_fields || []);
      } else {
        toast.error('Formulário não encontrado');
        router.push('/dashboard/forms');
      }
    } catch (error) {
      console.error('Error fetching form:', error);
      toast.error('Erro ao carregar formulário');
      router.push('/dashboard/forms');
    } finally {
      setLoading(false);
    }
  };

  const addField = (type: string) => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      type,
      label: '',
      name: '',
      placeholder: getDefaultPlaceholder(type),
      required: false,
      options: fieldRequiresOptions(type) ? [] : undefined,
      order_index: fields.length,
      is_active: true,
    };
    setFields([...fields, newField]);
    setEditingFieldIndex(fields.length);
    setFieldEditorData(newField);
  };

  const openFieldEditor = (index: number) => {
    setEditingFieldIndex(index);
    setFieldEditorData({ ...fields[index] });
  };

  const saveFieldEdit = () => {
    if (editingFieldIndex === null) return;

    const updatedFields = [...fields];
    updatedFields[editingFieldIndex] = fieldEditorData as FormField;
    
    // Auto-generate name if not set
    if (!updatedFields[editingFieldIndex].name && updatedFields[editingFieldIndex].label) {
      updatedFields[editingFieldIndex].name = generateFieldName(updatedFields[editingFieldIndex].label);
    }
    
    setFields(updatedFields);
    setEditingFieldIndex(null);
    setFieldEditorData({});
  };

  const cancelFieldEdit = () => {
    // If it's a new field that was never saved, remove it
    if (editingFieldIndex !== null && !fields[editingFieldIndex].label) {
      const updatedFields = fields.filter((_, i) => i !== editingFieldIndex);
      setFields(updatedFields);
    }
    setEditingFieldIndex(null);
    setFieldEditorData({});
  };

  const deleteField = (index: number) => {
    if (confirm('Tem certeza que deseja excluir este campo?')) {
      const updatedFields = fields.filter((_, i) => i !== index);
      setFields(updatedFields);
      if (editingFieldIndex === index) {
        setEditingFieldIndex(null);
        setFieldEditorData({});
      }
    }
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;

    const updatedFields = [...fields];
    [updatedFields[index], updatedFields[newIndex]] = [updatedFields[newIndex], updatedFields[index]];
    setFields(updatedFields);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formTitle.trim()) {
      toast.error('O título do formulário é obrigatório');
      return;
    }

    // Polo opcional: permitir formulário global (sem tenant)

    if (fields.length === 0) {
      toast.error('Adicione pelo menos um campo ao formulário');
      return;
    }

    // Validate fields
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      if (!field.label) {
        toast.error(`Campo ${i + 1}: O rótulo é obrigatório`);
        return;
      }
      if (!field.name) {
        toast.error(`Campo ${i + 1}: O nome é obrigatório`);
        return;
      }
      if (fieldRequiresOptions(field.type) && (!field.options || field.options.length === 0)) {
        toast.error(`Campo ${i + 1}: Adicione pelo menos uma opção`);
        return;
      }
    }

    if (requiresPayment && (!paymentAmount || parseFloat(paymentAmount) <= 0)) {
      toast.error('Informe o valor do pagamento');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/forms/${formId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formTitle,
          description: formDescription,
          // tenant_id opcional: somente enviar se houver seleção
          ...(selectedTenant ? { tenant_id: selectedTenant } : {}),
          is_active: isActive,
          // Enviar configurações dentro de settings
          settings: {
            ...(requiresPayment ? { require_payment: true } : { require_payment: false }),
            payment_amount: requiresPayment ? parseFloat(paymentAmount) : null,
          },
          fields,
        }),
      });

      if (response.ok) {
        toast.success('Formulário atualizado com sucesso!');
        router.push('/dashboard/forms');
      } else {
        const data = await response.json();
        toast.error(data.error || 'Erro ao atualizar formulário');
      }
    } catch (error) {
      console.error('Error updating form:', error);
      toast.error('Erro ao atualizar formulário');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard/forms')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Editar Formulário</h1>
            <p className="text-muted-foreground">Modifique campos e configurações</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <Button
            type="button"
            className="bg-brand-primary hover:bg-brand-primary/90"
            disabled={submitting}
            onClick={() => {
              const formEl = document.getElementById('editForm') as HTMLFormElement | null;
              formEl?.requestSubmit();
            }}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Salvar Alterações
          </Button>
        </div>
      </div>

      <form id="editForm" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Builder - Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
              <CardDescription>Configure título e descrição do formulário</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tenant">Polo</Label>
                <select
                  id="tenant"
                  value={selectedTenant}
                  onChange={(e) => setSelectedTenant(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-md"
                >
                  <option value="">— sem polo (global) —</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">Deixe vazio para manter como formulário global.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Título do Formulário *</Label>
                <Input
                  id="title"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ex: Inscrição 2025.1"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <textarea
                  id="description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Descrição opcional do formulário"
                  rows={3}
                  className="w-full px-3 py-2 text-sm border rounded-md"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  <Label htmlFor="is_active">Formulário ativo</Label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="requires_payment"
                    checked={requiresPayment}
                    onChange={(e) => setRequiresPayment(e.target.checked)}
                  />
                  <Label htmlFor="requires_payment">Requer pagamento</Label>
                </div>

                {requiresPayment && (
                  <div className="space-y-2 pl-6">
                    <Label htmlFor="payment_amount">Valor (R$) *</Label>
                    <Input
                      id="payment_amount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="150.00"
                      required={requiresPayment}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Fields List */}
          <Card>
            <CardHeader>
              <CardTitle>Campos do Formulário</CardTitle>
              <CardDescription>
                {fields.length} campo(s) adicionado(s)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {fields.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum campo adicionado. Clique em um tipo de campo à direita.
                </div>
              ) : (
                fields.map((field, index) => (
                  <div
                    key={field.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      editingFieldIndex === index
                        ? 'border-brand-primary bg-brand-primary/5'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => openFieldEditor(index)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <GripVertical className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">
                            {field.label || '(Sem rótulo)'}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {FIELD_TYPES.find((t) => t.value === field.type)?.label} • {field.name || '(Sem nome)'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveField(index, 'up');
                          }}
                          disabled={index === 0}
                        >
                          ↑
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveField(index, 'down');
                          }}
                          disabled={index === fields.length - 1}
                        >
                          ↓
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteField(index);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Field Editor */}
          {editingFieldIndex !== null && (
            <Card>
              <CardHeader>
                <CardTitle>Editar Campo</CardTitle>
                <CardDescription>
                  Configure as propriedades do campo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo de Campo</Label>
                  <Badge variant="secondary">
                    {FIELD_TYPES.find((t) => t.value === fieldEditorData.type)?.label}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="field_label">Rótulo *</Label>
                  <Input
                    id="field_label"
                    value={fieldEditorData.label || ''}
                    onChange={(e) => setFieldEditorData({ ...fieldEditorData, label: e.target.value })}
                    placeholder="Ex: Nome Completo"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="field_name">Nome (ID) *</Label>
                  <Input
                    id="field_name"
                    value={fieldEditorData.name || ''}
                    onChange={(e) => setFieldEditorData({ ...fieldEditorData, name: e.target.value })}
                    placeholder="Ex: nome_completo"
                  />
                  <p className="text-xs text-muted-foreground">
                    Usado para identificar o campo nos dados
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="field_placeholder">Placeholder</Label>
                  <Input
                    id="field_placeholder"
                    value={fieldEditorData.placeholder || ''}
                    onChange={(e) => setFieldEditorData({ ...fieldEditorData, placeholder: e.target.value })}
                    placeholder="Texto de ajuda"
                  />
                </div>

                {fieldRequiresOptions(fieldEditorData.type!) && (
                  <div className="space-y-2">
                    <Label>Opções</Label>
                    <div className="space-y-2">
                      {(fieldEditorData.options || []).map((option, i) => (
                        <div key={i} className="flex gap-2">
                          <Input
                            value={option}
                            onChange={(e) => {
                              const newOptions = [...(fieldEditorData.options || [])];
                              newOptions[i] = e.target.value;
                              setFieldEditorData({ ...fieldEditorData, options: newOptions });
                            }}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newOptions = (fieldEditorData.options || []).filter((_, idx) => idx !== i);
                              setFieldEditorData({ ...fieldEditorData, options: newOptions });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFieldEditorData({
                            ...fieldEditorData,
                            options: [...(fieldEditorData.options || []), ''],
                          });
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Opção
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="field_required"
                    checked={fieldEditorData.required || false}
                    onChange={(e) => setFieldEditorData({ ...fieldEditorData, required: e.target.checked })}
                  />
                  <Label htmlFor="field_required">Campo obrigatório</Label>
                </div>

                <div className="flex gap-2">
                  <Button type="button" onClick={saveFieldEdit} size="sm">
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Campo
                  </Button>
                  <Button type="button" variant="outline" onClick={cancelFieldEdit} size="sm">
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Field Types - Right Column */}
        <div className="space-y-6">
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle>Tipos de Campo</CardTitle>
              <CardDescription>Clique para adicionar ao formulário</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {FIELD_TYPES.map((fieldType) => (
                <Button
                  key={fieldType.value}
                  type="button"
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => addField(fieldType.value)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {fieldType.label}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-4">
              <Button
                type="submit"
                className="w-full bg-brand-primary hover:bg-brand-primary/90"
                disabled={submitting}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Salvar Alterações
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => router.push('/dashboard/forms')}
              >
                Cancelar
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
