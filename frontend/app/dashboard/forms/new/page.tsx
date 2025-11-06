'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Trash2, 
  GripVertical, 
  Loader2, 
  Save, 
  ArrowLeft,
  Eye,
  Settings as SettingsIcon
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

export default function NewFormPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form data
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  // Polo opcional: criação de formulário global por padrão
  // Status do formulário será sempre ativo por padrão na criação
  const [isActive, setIsActive] = useState(true);
  const [fields, setFields] = useState<FormField[]>([]);

  // Tenants
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [tenantsLoading, setTenantsLoading] = useState(false);

  // Field being edited
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [currentField, setCurrentField] = useState<Partial<FormField>>({
    label: '',
    name: '',
    type: 'text',
    required: false,
    placeholder: '',
    options: [],
    validation_rules: {},
    order_index: 0,
    is_active: true,
  });

  useEffect(() => {
    const loadTenants = async () => {
      setTenantsLoading(true);
      try {
        const response = await fetch('/api/tenants');
        const data = await response.json();
        if (response.ok) {
          setTenants(data.tenants || []);
        }
      } catch (error) {
        console.error('Error fetching tenants:', error);
        toast.error('Erro ao carregar polos');
      } finally {
        setTenantsLoading(false);
      }
    };
    loadTenants();
  }, []);

  const addField = (type: string) => {
    const newField: FormField = {
      label: `Campo ${fields.length + 1}`,
      name: `field_${fields.length + 1}`,
      type: type as any,
      required: false,
      placeholder: getDefaultPlaceholder(type as any),
      options: fieldRequiresOptions(type as any) ? [{ label: 'Opção 1', value: 'option_1' }] : [],
      validation_rules: {},
      order_index: fields.length,
      is_active: true,
    };

    setFields([...fields, newField]);
  };

  const removeField = (index: number) => {
    const updatedFields = fields.filter((_, i) => i !== index);
    // Reordenar
    updatedFields.forEach((field, i) => {
      field.order_index = i;
    });
    setFields(updatedFields);
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === fields.length - 1)
    ) {
      return;
    }

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const updatedFields = [...fields];
    const [movedField] = updatedFields.splice(index, 1);
    updatedFields.splice(newIndex, 0, movedField);

    // Atualizar order_index
    updatedFields.forEach((field, i) => {
      field.order_index = i;
    });

    setFields(updatedFields);
  };

  const editField = (index: number) => {
    setEditingFieldIndex(index);
    setCurrentField({ ...fields[index] });
  };

  const saveFieldEdit = () => {
    if (editingFieldIndex === null) return;

    if (!currentField.label || !currentField.name) {
      toast.error('Label e Name são obrigatórios');
      return;
    }

    const updatedFields = [...fields];
    updatedFields[editingFieldIndex] = currentField as FormField;
    setFields(updatedFields);
    setEditingFieldIndex(null);
    setCurrentField({
      label: '',
      name: '',
      type: 'text',
      required: false,
      placeholder: '',
      options: [],
      validation_rules: {},
      order_index: 0,
      is_active: true,
    });
    toast.success('Campo atualizado!');
  };

  const cancelEdit = () => {
    setEditingFieldIndex(null);
    setCurrentField({
      label: '',
      name: '',
      type: 'text',
      required: false,
      placeholder: '',
      options: [],
      validation_rules: {},
      order_index: 0,
      is_active: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formTitle) {
      toast.error('Título é obrigatório');
      return;
    }

    if (fields.length === 0) {
      toast.error('Adicione pelo menos um campo ao formulário');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        name: formTitle,
        description: formDescription || null,
        is_active: isActive,
        settings: {},
        ...(selectedTenant ? { tenant_id: selectedTenant } : {}),
        fields: fields.map(({ id, ...field }) => field), // Remove id para criar novos
      };

      const response = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Formulário criado com sucesso!');
        router.push('/dashboard/forms');
      } else {
        toast.error(data.error || 'Erro ao criar formulário');
      }
    } catch (error) {
      console.error('Error creating form:', error);
      toast.error('Erro ao criar formulário');
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
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Novo Formulário</h1>
            <p className="text-muted-foreground">Crie um formulário personalizado</p>
          </div>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="bg-brand-primary hover:bg-brand-primary/90"
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="mr-2 h-4 w-4" />
          Salvar Formulário
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configurações do Formulário */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
              <CardDescription>Configure os dados principais do formulário</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título do Formulário *</Label>
                <Input
                  id="title"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ex: Inscrição Vestibular 2025"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <textarea
                  id="description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Descreva o propósito deste formulário..."
                  className="w-full min-h-[80px] px-3 py-2 text-sm border rounded-md"
                />
              </div>

              {/* Observação: Polo e Status não são configurados manualmente aqui.
                  - O formulário é criado como Ativo por padrão.
                  - Opcionalmente, selecione um Polo para criar o formulário vinculado (obrigatório para admins). */}

              <div className="space-y-2">
                <Label>Polo (opcional — obrigatório para admins)</Label>
                <Select
                  value={selectedTenant}
                  onChange={(e) => setSelectedTenant(e.target.value)}
                  className="w-full"
                >
                  <option value="">
                    {tenantsLoading ? 'Carregando polos...' : 'Selecione um polo (opcional)'}
                  </option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground">
                  - Superadmin: pode criar formulário global deixando vazio.
                  <br />
                  - Admin: deve selecionar um polo.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Campos do Formulário */}
          <Card>
            <CardHeader>
              <CardTitle>Campos do Formulário ({fields.length})</CardTitle>
              <CardDescription>Arraste para reordenar os campos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {fields.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum campo adicionado ainda. Use o menu à direita para adicionar campos.
                </div>
              ) : (
                fields.map((field, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{field.label}</p>
                        {field.required && (
                          <Badge variant="destructive" className="text-xs">Obrigatório</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {FIELD_TYPES.find(t => t.value === field.type)?.label} • {field.name}
                      </p>
                    </div>

                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveField(index, 'up')}
                        disabled={index === 0}
                      >
                        ↑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveField(index, 'down')}
                        disabled={index === fields.length - 1}
                      >
                        ↓
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editField(index)}
                      >
                        <SettingsIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeField(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Tipos de Campo */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Adicionar Campos</CardTitle>
              <CardDescription>Clique para adicionar ao formulário</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {FIELD_TYPES.map((fieldType) => (
                <Button
                  key={fieldType.value}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => addField(fieldType.value)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {fieldType.label}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de Edição de Campo */}
      {editingFieldIndex !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Editar Campo</CardTitle>
              <CardDescription>Configure as propriedades do campo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Label (Rótulo) *</Label>
                  <Input
                    value={currentField.label}
                    onChange={(e) => {
                      const label = e.target.value;
                      setCurrentField({
                        ...currentField,
                        label,
                        name: generateFieldName(label),
                      });
                    }}
                    placeholder="Ex: Nome Completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Name (Identificador) *</Label>
                  <Input
                    value={currentField.name}
                    onChange={(e) => setCurrentField({ ...currentField, name: e.target.value })}
                    placeholder="Ex: nome_completo"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Placeholder</Label>
                <Input
                  value={currentField.placeholder || ''}
                  onChange={(e) => setCurrentField({ ...currentField, placeholder: e.target.value })}
                  placeholder="Texto de ajuda para o usuário"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={currentField.required}
                    onChange={(e) => setCurrentField({ ...currentField, required: e.target.checked })}
                  />
                  <span>Campo Obrigatório</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={currentField.is_active}
                    onChange={(e) => setCurrentField({ ...currentField, is_active: e.target.checked })}
                  />
                  <span>Campo Ativo</span>
                </label>
              </div>

              {fieldRequiresOptions(currentField.type as any) && (
                <div className="space-y-2">
                  <Label>Opções</Label>
                  <div className="space-y-2">
                    {currentField.options?.map((option, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          value={option.label}
                          onChange={(e) => {
                            const newOptions = [...(currentField.options || [])];
                            newOptions[i] = { ...option, label: e.target.value, value: generateFieldName(e.target.value) };
                            setCurrentField({ ...currentField, options: newOptions });
                          }}
                          placeholder="Label da opção"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const newOptions = currentField.options?.filter((_, idx) => idx !== i);
                            setCurrentField({ ...currentField, options: newOptions });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newOptions = [...(currentField.options || []), { label: '', value: '' }];
                        setCurrentField({ ...currentField, options: newOptions });
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar Opção
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={cancelEdit}>
                  Cancelar
                </Button>
                <Button onClick={saveFieldEdit} className="bg-brand-primary">
                  Salvar Alterações
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
