'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Settings as SettingsIcon, CreditCard, MessageCircle, Webhook } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('mercadopago');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [role, setRole] = useState<'superadmin' | 'admin' | 'user' | ''>('');

  // Mercado Pago
  const [mpConfig, setMpConfig] = useState({
    id: '',
    access_token: '',
    public_key: '',
    webhook_secret: '',
    is_sandbox: false,
    is_active: true,
  });

  // WhatsApp
  const [whatsappConfig, setWhatsappConfig] = useState({
    id: '',
    instance_name: '',
    api_url: '',
    api_key: '',
    is_active: true,
  });

  // n8n
  const [n8nConfig, setN8nConfig] = useState({
    id: '',
    webhook_url: '',
    auth_token: '',
    timeout_seconds: 30,
    max_retries: 3,
    is_active: true,
  });

  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    if (selectedTenant) {
      fetchConfigurations();
    }
  }, [selectedTenant, activeTab]);

  const fetchTenants = async () => {
    try {
      const response = await fetch('/api/tenants');
      const data = await response.json();
      if (response.ok) {
        setTenants(data.tenants || []);
        // Guardar papel do usuário para controle de visibilidade das abas
        if (data.role) {
          setRole(data.role);
          // Para admins, manter apenas WhatsApp e ajustar a aba ativa
          if (data.role === 'admin') {
            setActiveTab('whatsapp');
          }
        }
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

  const fetchConfigurations = async () => {
    if (!selectedTenant) return;

    try {
      setLoading(true);

      if (activeTab === 'mercadopago') {
        const response = await fetch(`/api/settings/mercadopago?tenant_id=${selectedTenant}`);
        const data = await response.json();
        if (response.ok && data.config) {
          setMpConfig(data.config);
        } else {
          // Reset to defaults
          setMpConfig({
            id: '',
            access_token: '',
            public_key: '',
            webhook_secret: '',
            is_sandbox: false,
            is_active: true,
          });
        }
      } else if (activeTab === 'whatsapp') {
        const response = await fetch(`/api/settings/whatsapp?tenant_id=${selectedTenant}`);
        const data = await response.json();
        if (response.ok && data.config) {
          setWhatsappConfig(data.config);
        } else {
          setWhatsappConfig({
            id: '',
            instance_name: '',
            api_url: '',
            api_key: '',
            is_active: true,
          });
        }
      } else if (activeTab === 'n8n') {
        const response = await fetch(`/api/settings/n8n?tenant_id=${selectedTenant}`);
        const data = await response.json();
        if (response.ok && data.config) {
          setN8nConfig(data.config);
        } else {
          setN8nConfig({
            id: '',
            webhook_url: '',
            auth_token: '',
            timeout_seconds: 30,
            max_retries: 3,
            is_active: true,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMercadoPago = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const method = mpConfig.id ? 'PATCH' : 'POST';
      const url = mpConfig.id
        ? `/api/settings/mercadopago/${mpConfig.id}`
        : '/api/settings/mercadopago';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: selectedTenant,
          ...mpConfig,
        }),
      });

      if (response.ok) {
        toast.success('Configuração do Mercado Pago salva com sucesso!');
        fetchConfigurations();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Erro ao salvar configuração');
      }
    } catch (error) {
      toast.error('Erro ao salvar configuração');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const method = whatsappConfig.id ? 'PATCH' : 'POST';
      const url = whatsappConfig.id
        ? `/api/settings/whatsapp/${whatsappConfig.id}`
        : '/api/settings/whatsapp';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: selectedTenant,
          ...whatsappConfig,
        }),
      });

      if (response.ok) {
        toast.success('Configuração do WhatsApp salva com sucesso!');
        fetchConfigurations();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Erro ao salvar configuração');
      }
    } catch (error) {
      toast.error('Erro ao salvar configuração');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveN8n = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const method = n8nConfig.id ? 'PATCH' : 'POST';
      const url = n8nConfig.id
        ? `/api/settings/n8n/${n8nConfig.id}`
        : '/api/settings/n8n';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: selectedTenant,
          ...n8nConfig,
        }),
      });

      if (response.ok) {
        toast.success('Configuração do n8n salva com sucesso!');
        fetchConfigurations();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Erro ao salvar configuração');
      }
    } catch (error) {
      toast.error('Erro ao salvar configuração');
    } finally {
      setSubmitting(false);
    }
  };

  // Abas de configurações: para admins, exibir apenas WhatsApp
  const tabs = role === 'admin'
    ? [{ id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle }]
    : [
        { id: 'mercadopago', label: 'Mercado Pago', icon: CreditCard },
        { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
        { id: 'n8n', label: 'n8n/Moodle', icon: Webhook },
      ];

  if (loading && !selectedTenant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {role !== 'admin' && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Configurações</h1>
            <p className="text-muted-foreground">Configure integrações e webhooks</p>
          </div>
        </div>
      )}

      {/* Seleção de Polo */}
      {role !== 'admin' && (
        <Card>
          <CardHeader>
            <CardTitle>Polo</CardTitle>
            <CardDescription>Selecione o polo para configurar</CardDescription>
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
      )}

      {/* Tabs */}
      {tabs.length > 1 && (
        <div className="flex gap-2 border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-brand-primary text-brand-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Mercado Pago Tab */}
      {activeTab === 'mercadopago' && (
        <Card>
          <CardHeader>
            <CardTitle>Configuração do Mercado Pago</CardTitle>
            <CardDescription>
              Configure as credenciais da sua conta Mercado Pago para processar pagamentos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveMercadoPago} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="access_token">Access Token *</Label>
                <Input
                  id="access_token"
                  type="password"
                  value={mpConfig.access_token}
                  onChange={(e) => setMpConfig({ ...mpConfig, access_token: e.target.value })}
                  placeholder="APP_USR-..."
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Token de acesso da sua aplicação Mercado Pago
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="public_key">Public Key (opcional)</Label>
                <Input
                  id="public_key"
                  value={mpConfig.public_key}
                  onChange={(e) => setMpConfig({ ...mpConfig, public_key: e.target.value })}
                  placeholder="APP_USR-..."
                />
                <p className="text-xs text-muted-foreground">
                  Chave pública para checkout transparente
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook_secret">Webhook Secret (opcional)</Label>
                <Input
                  id="webhook_secret"
                  type="password"
                  value={mpConfig.webhook_secret}
                  onChange={(e) => setMpConfig({ ...mpConfig, webhook_secret: e.target.value })}
                  placeholder="Secret para validar webhooks"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={mpConfig.is_sandbox}
                    onChange={(e) => setMpConfig({ ...mpConfig, is_sandbox: e.target.checked })}
                  />
                  <span>Modo Sandbox (Testes)</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={mpConfig.is_active}
                    onChange={(e) => setMpConfig({ ...mpConfig, is_active: e.target.checked })}
                  />
                  <span>Ativo</span>
                </label>
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-brand-primary hover:bg-brand-primary/90"
                >
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Configuração
                </Button>
              </div>

              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                <h4 className="font-semibold mb-2">URL do Webhook:</h4>
                <code className="text-sm bg-white dark:bg-gray-800 p-2 rounded block">
                  {typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/mercadopago
                </code>
                <p className="text-xs text-muted-foreground mt-2">
                  Configure esta URL nas notificações IPN do Mercado Pago
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* WhatsApp Tab */}
      {activeTab === 'whatsapp' && (
        <Card>
          <CardHeader>
            <CardTitle>Configuração do WhatsApp (Evolution API)</CardTitle>
            <CardDescription>
              Configure a Evolution API para enviar mensagens automáticas via WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveWhatsApp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="instance_name">Nome da Instância *</Label>
                <Input
                  id="instance_name"
                  value={whatsappConfig.instance_name}
                  onChange={(e) => setWhatsappConfig({ ...whatsappConfig, instance_name: e.target.value })}
                  placeholder="minha-instancia"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Nome da instância configurada na Evolution API
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="api_url">URL da API *</Label>
                <Input
                  id="api_url"
                  value={whatsappConfig.api_url}
                  onChange={(e) => setWhatsappConfig({ ...whatsappConfig, api_url: e.target.value })}
                  placeholder="https://evolution.seudominio.com"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  URL base da sua Evolution API
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="api_key">API Key *</Label>
                <Input
                  id="api_key"
                  type="password"
                  value={whatsappConfig.api_key}
                  onChange={(e) => setWhatsappConfig({ ...whatsappConfig, api_key: e.target.value })}
                  placeholder="B6D711FCDE4D4FD5936544120E713976"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Chave de autenticação da Evolution API
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={whatsappConfig.is_active}
                  onChange={(e) => setWhatsappConfig({ ...whatsappConfig, is_active: e.target.checked })}
                />
                <span>Ativo</span>
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-brand-primary hover:bg-brand-primary/90"
                >
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Configuração
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* n8n Tab */}
      {activeTab === 'n8n' && (
        <Card>
          <CardHeader>
            <CardTitle>Configuração n8n/Moodle</CardTitle>
            <CardDescription>
              Configure o webhook para enviar dados automaticamente para n8n (matrícula Moodle)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveN8n} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="webhook_url">URL do Webhook *</Label>
                <Input
                  id="webhook_url"
                  value={n8nConfig.webhook_url}
                  onChange={(e) => setN8nConfig({ ...n8nConfig, webhook_url: e.target.value })}
                  placeholder="https://n8n.seudominio.com/webhook/..."
                  required
                />
                <p className="text-xs text-muted-foreground">
                  URL do webhook do n8n que receberá os dados
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="auth_token">Token de Autenticação (opcional)</Label>
                <Input
                  id="auth_token"
                  type="password"
                  value={n8nConfig.auth_token}
                  onChange={(e) => setN8nConfig({ ...n8nConfig, auth_token: e.target.value })}
                  placeholder="Bearer token..."
                />
                <p className="text-xs text-muted-foreground">
                  Token para autenticação Bearer (se necessário)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timeout_seconds">Timeout (segundos)</Label>
                  <Input
                    id="timeout_seconds"
                    type="number"
                    value={n8nConfig.timeout_seconds}
                    onChange={(e) => setN8nConfig({ ...n8nConfig, timeout_seconds: parseInt(e.target.value) })}
                    min="5"
                    max="120"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_retries">Tentativas Máximas</Label>
                  <Input
                    id="max_retries"
                    type="number"
                    value={n8nConfig.max_retries}
                    onChange={(e) => setN8nConfig({ ...n8nConfig, max_retries: parseInt(e.target.value) })}
                    min="0"
                    max="10"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={n8nConfig.is_active}
                  onChange={(e) => setN8nConfig({ ...n8nConfig, is_active: e.target.checked })}
                />
                <span>Ativo</span>
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-brand-primary hover:bg-brand-primary/90"
                >
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Configuração
                </Button>
              </div>

              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                <h4 className="font-semibold mb-2">Payload enviado:</h4>
                <pre className="text-xs bg-white dark:bg-gray-800 p-3 rounded overflow-x-auto">
{`{
  "submission_id": "uuid",
  "tenant_id": "uuid",
  "tenant_name": "Nome do Polo",
  "student_data": {
    "nome": "João Silva",
    "email": "joao@example.com",
    ...
  },
  "payment_amount": 150.00,
  "payment_date": "2025-11-05T...",
  "form_title": "Inscrição 2025"
}`}
                </pre>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
