'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Save, 
  Plus, 
  MessageCircle, 
  Edit, 
  Trash2,
  X
} from 'lucide-react';
import { toast } from 'sonner';

interface WhatsAppTemplate {
  id: string;
  tenant_id: string;
  name: string;
  message_template: string;
  trigger_event: 'payment_approved' | 'submission_created' | 'manual';
  is_active: boolean;
  created_at: string;
}

export default function TemplatesPage() {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    message_template: '',
    trigger_event: 'payment_approved' as 'payment_approved' | 'submission_created' | 'manual',
    is_active: true,
  });

  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    if (selectedTenant) {
      fetchTemplates();
    }
  }, [selectedTenant]);

  const fetchTenants = async () => {
    try {
      const response = await fetch('/api/tenants');
      const data = await response.json();
      if (response.ok) {
        setTenants(data.tenants || []);
        if (data.tenants?.length > 0) {
          setSelectedTenant(data.tenants[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    if (!selectedTenant) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/templates?tenant_id=${selectedTenant}`);
      const data = await response.json();
      if (response.ok) {
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const method = editingTemplate ? 'PATCH' : 'POST';
      const url = editingTemplate 
        ? `/api/templates/${editingTemplate.id}` 
        : '/api/templates';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: selectedTenant,
          ...formData,
        }),
      });

      if (response.ok) {
        toast.success(editingTemplate ? 'Template atualizado!' : 'Template criado!');
        fetchTemplates();
        resetForm();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Erro ao salvar template');
      }
    } catch (error) {
      toast.error('Erro ao salvar template');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (template: WhatsAppTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      message_template: template.message_template,
      trigger_event: template.trigger_event,
      is_active: template.is_active,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este template?')) return;

    try {
      const response = await fetch(`/api/templates/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Template excluído!');
        fetchTemplates();
      } else {
        toast.error('Erro ao excluir template');
      }
    } catch (error) {
      toast.error('Erro ao excluir template');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      message_template: '',
      trigger_event: 'payment_approved',
      is_active: true,
    });
    setEditingTemplate(null);
    setShowForm(false);
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('message_template') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = formData.message_template;
      const newText = text.substring(0, start) + variable + text.substring(end);
      setFormData({ ...formData, message_template: newText });
      
      // Restaurar foco e posição do cursor
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    }
  };

  const variables = [
    { label: 'Nome', value: '{{nome}}' },
    { label: 'Email', value: '{{email}}' },
    { label: 'Telefone', value: '{{telefone}}' },
    { label: 'CPF', value: '{{cpf}}' },
    { label: 'Valor', value: '{{valor}}' },
    { label: 'Nome do Polo', value: '{{polo}}' },
    { label: 'Título do Formulário', value: '{{formulario}}' },
  ];

  const triggerLabels = {
    payment_approved: 'Pagamento Aprovado',
    submission_created: 'Inscrição Criada',
    manual: 'Manual',
  };

  if (loading && templates.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Templates WhatsApp</h1>
          <p className="text-muted-foreground">Gerencie mensagens automáticas do WhatsApp</p>
        </div>
        <Button 
          onClick={() => setShowForm(true)}
          className="bg-brand-primary hover:bg-brand-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo Template
        </Button>
      </div>

      {/* Seleção de Polo */}
      <Card>
        <CardHeader>
          <CardTitle>Polo</CardTitle>
          <CardDescription>Selecione o polo para gerenciar templates</CardDescription>
        </CardHeader>
        <CardContent>
          <select
            value={selectedTenant}
            onChange={(e) => setSelectedTenant(e.target.value)}
            className="w-full max-w-md px-3 py-2 text-sm border rounded-md"
          >
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{editingTemplate ? 'Editar Template' : 'Novo Template'}</CardTitle>
              <CardDescription>Configure a mensagem que será enviada automaticamente</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={resetForm}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Template *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Confirmação de Pagamento"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="trigger_event">Quando Enviar *</Label>
                <select
                  id="trigger_event"
                  value={formData.trigger_event}
                  onChange={(e) => setFormData({ ...formData, trigger_event: e.target.value as any })}
                  className="w-full px-3 py-2 text-sm border rounded-md"
                  required
                >
                  <option value="payment_approved">Pagamento Aprovado</option>
                  <option value="submission_created">Inscrição Criada</option>
                  <option value="manual">Manual</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message_template">Mensagem *</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {variables.map((variable) => (
                    <Button
                      key={variable.value}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => insertVariable(variable.value)}
                    >
                      {variable.label}
                    </Button>
                  ))}
                </div>
                <textarea
                  id="message_template"
                  value={formData.message_template}
                  onChange={(e) => setFormData({ ...formData, message_template: e.target.value })}
                  placeholder="Olá {{nome}}, seu pagamento de R$ {{valor}} foi aprovado!"
                  rows={6}
                  className="w-full px-3 py-2 text-sm border rounded-md"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Use as variáveis acima para personalizar a mensagem
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
                <Label htmlFor="is_active">Ativo</Label>
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-brand-primary hover:bg-brand-primary/90"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  {editingTemplate ? 'Atualizar' : 'Criar'} Template
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Lista de Templates */}
      <div className="grid gap-4">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-brand-primary" />
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    {template.is_active ? (
                      <Badge className="bg-green-500">Ativo</Badge>
                    ) : (
                      <Badge variant="secondary">Inativo</Badge>
                    )}
                  </div>
                  <CardDescription>
                    Gatilho: {triggerLabels[template.trigger_event]}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(template)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(template.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded-md">
                <pre className="text-sm whitespace-pre-wrap">{template.message_template}</pre>
              </div>
            </CardContent>
          </Card>
        ))}

        {templates.length === 0 && !showForm && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Nenhum template encontrado. Clique em "Novo Template" para criar um.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
