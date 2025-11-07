'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

type StatusResponse = {
  env: { app_url_configured: boolean; mp_token_configured: boolean };
  app_url: string | null;
  app_url_error?: string | null;
  mp_token_masked: string;
  test_preference: {
    success: boolean;
    id?: string;
    init_point?: string;
    error?: string;
    detail?: string;
    meta?: { status?: number; code?: string; blocked_by?: string };
  };
};

export default function IntegrationStatusPage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runCheck = async () => {
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch('/api/integration/mercadopago/status');
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Falha ao verificar integração');
      } else {
        setStatus(data);
      }
    } catch (e: any) {
      setError('Erro inesperado ao verificar integração');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Status da Integração — Mercado Pago</h1>
        <p className="text-sm text-muted-foreground">Página para admins verificarem configuração e acesso à API.</p>
      </div>

      <div className="flex gap-3 mb-6">
        <Button onClick={runCheck} disabled={loading}>
          {loading ? (
            <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Verificando...</span>
          ) : (
            'Verificar integração'
          )}
        </Button>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {status && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Variáveis de Ambiente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                {status.env.app_url_configured ? (
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
                <div>
                  <div className="text-sm">APP_URL</div>
                  <div className="text-xs text-muted-foreground break-all">{status.app_url || 'não configurado'}</div>
                  {status.app_url_error && (
                    <div className="text-xs text-destructive">{status.app_url_error}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {status.env.mp_token_configured ? (
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
                <div>
                  <div className="text-sm">MP_ACCESS_TOKEN</div>
                  <div className="text-xs text-muted-foreground">{status.mp_token_masked}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Teste de Preferência</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {status.test_preference?.success ? (
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5" />
                  <div className="text-sm">
                    Preferência criada com sucesso. ID: {status.test_preference.id}
                    <div className="text-xs break-all text-muted-foreground">{status.test_preference.init_point}</div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                  <div>
                    <div className="text-sm">{status.test_preference?.error || 'Falha ao criar preferência'}</div>
                    {status.test_preference?.detail && (
                      <div className="text-xs text-muted-foreground">{status.test_preference.detail}</div>
                    )}
                    {status.test_preference?.meta && (
                      <div className="text-xs text-muted-foreground">
                        {Object.entries(status.test_preference.meta)
                          .filter(([, v]) => v !== undefined && v !== null)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' | ')}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}