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
  const [role, setRole] = useState<'superadmin' | 'admin' | 'user' | ''>('');

  // Mercado Pago
  // Status do Mercado Pago via variáveis de ambiente
  const [mpStatus, setMpStatus] = useState<any>(null);

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
    fetchConfigurations();
  }, []);

  useEffect(() => {
    fetchConfigurations();
  }, [activeTab]);

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
        // Sem dependência de tenant para configurações globais
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchConfigurations = async () => {
    try {
      setLoading(true);

      if (activeTab === 'mercadopago') {
        const response = await fetch('/api/integration/mercadopago/status');
        const data = await response.json();
        if (response.ok) {
          setMpStatus(data);
        } else {
          setMpStatus(null);
        }
      } else if (activeTab === 'whatsapp') {
        const response = await fetch('/api/settings/whatsapp');
        const data = await response.json();
        if (response.ok && data.config) {
          // Mapear campos do backend (instance_id/api_base_url/token) para os inputs da UI
          setWhatsappConfig({
            id: data.config.id || '',
            instance_name: data.config.instance_id || '',
            api_url: data.config.api_base_url || '',
            api_key: data.config.token || '',
            is_active: data.config.is_active !== false,
          });
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
        const response = await fetch('/api/settings/n8n');
        const data = await response.json();
        if (response.ok && data.config) {
          setN8nConfig({
            id: data.config.id || '',
            webhook_url: data.config.enrollment_webhook_url || '',
            auth_token: data.config.enrollment_webhook_token || '',
            timeout_seconds: Math.round((data.config.timeout_ms ?? 30000) / 1000),
            max_retries: data.config.retries ?? 3,
            is_active: data.config.is_active !== false,
          });
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

  // Mercado Pago agora é baseado em variáveis de ambiente; não há formulário de salvamento

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

  if (loading) {
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
              Integração baseada em variáveis de ambiente. Consulte o status abaixo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded">
                  <div className="flex items-center justify-between">
                    <span>Access Token (MP_ACCESS_TOKEN)</span>
                    <Badge variant={mpStatus?.has_mp_access_token ? 'default' : 'destructive'}>
                      {mpStatus?.has_mp_access_token ? 'Configurado' : 'Faltando'}
                    </Badge>
                  </div>
                  {mpStatus?.masked_mp_access_token && (
                    <code className="mt-2 block text-xs bg-white dark:bg-gray-800 p-2 rounded">
                      {mpStatus.masked_mp_access_token}
                    </code>
                  )}
                </div>
                <div className="p-4 border rounded">
                  <div className="flex items-center justify-between">
                    <span>APP_URL</span>
                    <Badge variant={mpStatus?.has_app_url ? 'default' : 'destructive'}>
                      {mpStatus?.has_app_url ? 'Configurado' : 'Faltando'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="p-4 border rounded">
                <div className="flex items-center justify-between">
                  <span>Teste de Preferência</span>
                  <Badge variant={mpStatus?.preference_test?.ok ? 'default' : 'destructive'}>
                    {mpStatus?.preference_test?.ok ? 'Token válido' : 'Falhou'}
                  </Badge>
                </div>
                {!mpStatus?.preference_test?.ok && mpStatus?.preference_test?.error && (
                  <p className="mt-2 text-xs text-muted-foreground">Erro: {mpStatus.preference_test.error}</p>
                )}
                <div className="pt-4">
                  <Button
                    onClick={() => fetchConfigurations()}
                    className="bg-brand-primary hover:bg-brand-primary/90"
                  >
                    Re-testar
                  </Button>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                <h4 className="font-semibold mb-2">URL do Webhook:</h4>
                <code className="text-sm bg-white dark:bg-gray-800 p-2 rounded block">
                  {typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/mercadopago
                </code>
                <p className="text-xs text-muted-foreground mt-2">
                  Configure esta URL nas notificações IPN do Mercado Pago.
                  Credenciais agora devem ser definidas em .env: MP_ACCESS_TOKEN e APP_URL.
                </p>
              </div>
            </div>
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
