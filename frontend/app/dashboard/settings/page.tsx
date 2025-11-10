'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Settings as SettingsIcon, CreditCard, MessageCircle, Webhook, CheckCircle, XCircle, QrCode } from 'lucide-react';
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
  // Formulário global para credenciais do Mercado Pago (somente superadmin edita)
  const [mpGlobalConfig, setMpGlobalConfig] = useState({
    id: '',
    access_token: '',
    public_key: '',
    webhook_secret: '',
    is_production: false,
    is_active: true,
    masked_access_token: '',
    masked_public_key: '',
    masked_webhook_secret: '',
  });

  // WhatsApp
  const [whatsappConfig, setWhatsappConfig] = useState({
    id: '',
    instance_name: '',
    api_url: '',
    api_key: '',
    is_active: true,
  });
  const [whatsappTestLoading, setWhatsappTestLoading] = useState(false);
  const [whatsappTestResult, setWhatsappTestResult] = useState<any>(null);
  const [whatsappQrLoading, setWhatsappQrLoading] = useState(false);
  const [whatsappQrData, setWhatsappQrData] = useState<any>(null);

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

  // Sem dependência de tenant para Mercado Pago (global)

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

  // Mercado Pago não depende de tenant: nenhuma seleção padrão necessária

  const handleTestWhatsApp = async () => {
    setWhatsappTestLoading(true);
    setWhatsappTestResult(null);

    try {
      const response = await fetch('/api/settings/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_url: whatsappConfig.api_url,
          api_key: whatsappConfig.api_key,
          instance_name: whatsappConfig.instance_name,
        }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setWhatsappTestResult({
          success: true,
          message: data.message,
          instances: data.instances,
          total_instances: data.total_instances,
          connected_instances: data.connected_instances,
          connection_state: data.connection_state ?? null,
        });
        toast.success(data.message);
      } else {
        setWhatsappTestResult({
          success: false,
          error: data.error || 'Erro ao testar conexão',
          instances: data.instances || [],
        });
        toast.error(data.error || 'Erro ao testar conexão');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao testar conexão';
      setWhatsappTestResult({
        success: false,
        error: errorMessage,
        instances: [],
      });
      toast.error('Erro ao testar conexão');
    } finally {
      setWhatsappTestLoading(false);
    }
  };

  const handleShowWhatsAppQr = async () => {
    setWhatsappQrLoading(true);
    setWhatsappQrData(null);

    try {
      const response = await fetch('/api/settings/whatsapp/qrcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_url: whatsappConfig.api_url,
          api_key: whatsappConfig.api_key,
          instance_name: whatsappConfig.instance_name,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setWhatsappQrData(data);
        if (data.qrcode_base64) {
          toast.success('QR Code carregado. Escaneie para conectar.');
        } else if (String(data.state || '').toLowerCase() === 'open') {
          toast.info('Instância já conectada — não há QR Code disponível.');
        } else {
          toast.success(data.message || 'QR Code disponível.');
        }
      } else {
        setWhatsappQrData({ success: false, error: data.error || 'Falha ao obter QR Code' });
        toast.error(data.error || 'Falha ao obter QR Code');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao obter QR Code';
      setWhatsappQrData({ success: false, error: errorMessage });
      toast.error('Erro ao obter QR Code');
    } finally {
      setWhatsappQrLoading(false);
    }
  };

  // Mercado Pago global: não há função de salvar credenciais via UI

  // Testar status de integração (global)
  const handleTestMercadoPago = async () => {
    try {
      const resp = await fetch(`/api/integration/mercadopago/status`);
      const data = await resp.json();
      if (resp.ok) {
        setMpStatus(data);
        toast.success('Teste executado.');
      } else {
        toast.error(data.error || 'Falha no teste');
      }
    } catch (err) {
      toast.error('Falha ao testar preferência');
    }
  };

  const fetchConfigurations = async () => {
    try {
      setLoading(true);

      if (activeTab === 'mercadopago') {
        // Carregar status global
        const stResp = await fetch(`/api/integration/mercadopago/status`);
        const stData = await stResp.json();
        setMpStatus(stResp.ok ? stData : null);

        // Carregar configuração global (não expõe valor completo dos tokens)
        const cfgResp = await fetch('/api/settings/mercadopago-global');
        const cfgData = await cfgResp.json();
        if (cfgResp.ok && cfgData.config) {
          setMpGlobalConfig((prev) => ({
            ...prev,
            id: cfgData.config.id || '',
            is_production: !!cfgData.config.is_production,
            is_active: cfgData.config.is_active !== false,
            masked_access_token: cfgData.config.masked_access_token || '',
            masked_public_key: cfgData.config.masked_public_key || '',
            masked_webhook_secret: cfgData.config.masked_webhook_secret || '',
          }));
        } else {
          setMpGlobalConfig((prev) => ({
            ...prev,
            id: '',
            is_production: false,
            is_active: true,
            masked_access_token: '',
            masked_public_key: '',
            masked_webhook_secret: '',
          }));
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
  const handleSaveMercadoPagoGlobal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/settings/mercadopago-global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: mpGlobalConfig.access_token,
          public_key: mpGlobalConfig.public_key,
          webhook_secret: mpGlobalConfig.webhook_secret,
          is_production: mpGlobalConfig.is_production,
          is_active: mpGlobalConfig.is_active,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        toast.success('Credenciais do Mercado Pago salvas com sucesso!');
        // Limpar campos sensíveis após salvar
        setMpGlobalConfig((prev) => ({
          ...prev,
          access_token: '',
          public_key: '',
          webhook_secret: '',
        }));
        fetchConfigurations();
      } else {
        toast.error(data.error || 'Erro ao salvar credenciais');
      }
    } catch (error) {
      toast.error('Erro ao salvar credenciais');
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
              Integração global. Cadastre as credenciais abaixo ou valide o status.
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
                  {mpGlobalConfig.masked_access_token && (
                    <p className="mt-2 text-[11px] text-muted-foreground">Banco: {mpGlobalConfig.masked_access_token}</p>
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
                  <Badge variant={mpStatus?.preference_test?.success ? 'default' : 'destructive'}>
                    {mpStatus?.preference_test?.success ? 'Token válido' : 'Falhou'}
                  </Badge>
                </div>
                {mpStatus?.preference_test && !mpStatus.preference_test.success && mpStatus.preference_test.error && (
                  <p className="mt-2 text-xs text-muted-foreground">Erro: {mpStatus.preference_test.error}</p>
                )}
                <div className="pt-4">
                  <Button
                    onClick={handleTestMercadoPago}
                    className="bg-brand-primary hover:bg-brand-primary/90"
                  >
                    Re-testar
                  </Button>
                </div>
              </div>

              {role === 'superadmin' && (
                <form onSubmit={handleSaveMercadoPagoGlobal} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="mp_access_token">Access Token *</Label>
                      <Input
                        id="mp_access_token"
                        type="password"
                        value={mpGlobalConfig.access_token}
                        onChange={(e) => setMpGlobalConfig({ ...mpGlobalConfig, access_token: e.target.value })}
                        placeholder="Insira o access token do Mercado Pago"
                        required
                      />
                      {mpGlobalConfig.masked_access_token && (
                        <p className="text-xs text-muted-foreground">Salvo: {mpGlobalConfig.masked_access_token}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mp_public_key">Public Key (opcional)</Label>
                      <Input
                        id="mp_public_key"
                        type="password"
                        value={mpGlobalConfig.public_key}
                        onChange={(e) => setMpGlobalConfig({ ...mpGlobalConfig, public_key: e.target.value })}
                        placeholder="PUBLIC_KEY"
                      />
                      {mpGlobalConfig.masked_public_key && (
                        <p className="text-xs text-muted-foreground">Salvo: {mpGlobalConfig.masked_public_key}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="mp_webhook_secret">Webhook Secret (opcional)</Label>
                      <Input
                        id="mp_webhook_secret"
                        type="password"
                        value={mpGlobalConfig.webhook_secret}
                        onChange={(e) => setMpGlobalConfig({ ...mpGlobalConfig, webhook_secret: e.target.value })}
                        placeholder="Segredo para validar webhooks"
                      />
                      {mpGlobalConfig.masked_webhook_secret && (
                        <p className="text-xs text-muted-foreground">Salvo: {mpGlobalConfig.masked_webhook_secret}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={mpGlobalConfig.is_production}
                        onChange={(e) => setMpGlobalConfig({ ...mpGlobalConfig, is_production: e.target.checked })}
                      />
                      Produção
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={mpGlobalConfig.is_active}
                        onChange={(e) => setMpGlobalConfig({ ...mpGlobalConfig, is_active: e.target.checked })}
                      />
                      Ativo
                    </label>
                  </div>

                  <div className="pt-2">
                    <Button type="submit" disabled={submitting} className="bg-brand-primary hover:bg-brand-primary/90">
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Save className="mr-2 h-4 w-4" />
                      Salvar Credenciais
                    </Button>
                  </div>
                </form>
              )}

              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                <h4 className="font-semibold mb-2">URL do Webhook:</h4>
                <code className="text-sm bg-white dark:bg-gray-800 p-2 rounded block">
                  {typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/mercadopago
                </code>
                <p className="text-xs text-muted-foreground mt-2">
                  Configure esta URL nas notificações IPN do Mercado Pago. Você pode salvar as credenciais globalmente pelo painel (somente superadmin). Caso não haja configuração no banco, será usado MP_ACCESS_TOKEN do ambiente.
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

              {/* Área de Teste */}
              <div className="pt-4 border-t">
                <h4 className="font-semibold mb-3">Testar Conexão</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Teste a conexão com a Evolution API e visualize as instâncias disponíveis.
                </p>
                
                <Button
                  type="button"
                  onClick={handleTestWhatsApp}
                  disabled={whatsappTestLoading || !whatsappConfig.api_url || !whatsappConfig.api_key}
                  variant="outline"
                  className="mb-4"
                >
                  {whatsappTestLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <MessageCircle className="mr-2 h-4 w-4" />
                  )}
                  Testar Conexão
                </Button>

                <Button
                  type="button"
                  onClick={handleShowWhatsAppQr}
                  disabled={whatsappQrLoading || !whatsappConfig.api_url || !whatsappConfig.api_key || !whatsappConfig.instance_name}
                  variant="outline"
                  className="mb-4 ml-2"
                >
                  {whatsappQrLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <QrCode className="mr-2 h-4 w-4" />
                  )}
                  Mostrar QR Code
                </Button>

                {/* Resultados do Teste */}
                {whatsappTestResult && (
                  <div className={`p-4 rounded-md ${whatsappTestResult.success ? 'bg-green-50 dark:bg-green-900/20 border border-green-200' : 'bg-red-50 dark:bg-red-900/20 border border-red-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {whatsappTestResult.success ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      <span className={`font-semibold ${whatsappTestResult.success ? 'text-green-800' : 'text-red-800'}`}>
                        {whatsappTestResult.success ? 'Conexão bem-sucedida!' : 'Erro na conexão'}
                      </span>
                    </div>
                    
                    {whatsappTestResult.success ? (
                      <div className="space-y-2">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {whatsappTestResult.message}
                        </p>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Total de Instâncias:</span>
                            <span className="ml-2">{whatsappTestResult.total_instances}</span>
                          </div>
                          <div>
                            <span className="font-medium">Conectadas:</span>
                            <span className="ml-2 text-green-600">{whatsappTestResult.connected_instances}</span>
                          </div>
                        </div>
                        
                        {whatsappTestResult.instances && whatsappTestResult.instances.length > 0 && (
                          <div className="mt-3">
                            <h5 className="font-medium mb-2">Instâncias Encontradas:</h5>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                              {whatsappTestResult.instances.map((instance: any, index: number) => (
                                <div key={index} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border">
                                  <div>
                                    <div className="font-medium text-sm">{instance.name}</div>
                                    <div className="text-xs text-gray-500">{instance.number}</div>
                                  </div>
                                  {(() => {
                                    const connectionLabel = (instance.connectionStatus ?? instance.status ?? 'unknown');
                                    const statusLabel = (instance.status ?? 'unknown');
                                    const conn = String(connectionLabel).toLowerCase();
                                    const isConnected = conn === 'open' || conn === 'connected';
                                    return (
                                      <div className="flex items-center gap-2">
                                        <div className={`px-2 py-1 rounded text-xs font-medium ${
                                          isConnected ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                        }`}>
                                          Conexão: {connectionLabel}
                                        </div>
                                        <div className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100">
                                          Status: {statusLabel}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-red-700 dark:text-red-300">
                        {whatsappTestResult.error}
                      </p>
                    )}
                  </div>
                )}

                {/* QR Code da Instância */}
                {whatsappQrData && (
                  <div className={`mt-4 p-4 rounded-md ${whatsappQrData.success ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200' : 'bg-red-50 dark:bg-red-900/20 border border-red-200'}`}>
                    {whatsappQrData.success ? (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <QrCode className="h-5 w-5 text-blue-600" />
                          <span className="font-semibold text-blue-800">QR Code</span>
                        </div>
                        {whatsappQrData.qrcode_base64 ? (
                          <div className="flex flex-col items-start">
                            <img
                              src={`data:image/png;base64,${whatsappQrData.qrcode_base64}`}
                              alt="QR Code WhatsApp"
                              className="border rounded p-2 bg-white dark:bg-gray-800"
                              style={{ maxWidth: 240 }}
                            />
                            <p className="mt-2 text-xs text-muted-foreground">Escaneie este QR Code no WhatsApp para conectar.</p>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            {whatsappQrData.message || 'Instância já conectada — QR Code não disponível.'}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <XCircle className="h-5 w-5 text-red-600" />
                        <p className="text-sm text-red-700 dark:text-red-300">{whatsappQrData.error}</p>
                      </div>
                    )}
                  </div>
                )}
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
