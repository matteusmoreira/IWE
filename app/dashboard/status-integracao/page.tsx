'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'

type StatusPayload = {
  env: {
    accessTokenConfigured: boolean
    tokenMasked: string
    appUrlConfigured: boolean
    appUrl: string | null
  }
  test: {
    ok: boolean
    preference_id?: string | null
    init_point?: string | null
    error?: string
    status?: number | null
    code?: string | null
    cause?: any
  }
  timestamp: string
}

export default function StatusIntegracaoPage() {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<StatusPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runCheck = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/integration/mercadopago/status')
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || 'Falha na verificação')
        setStatus(null)
      } else {
        setStatus(data as StatusPayload)
      }
    } catch (e: any) {
      setError(e?.message ?? 'Erro inesperado')
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Status de Integração</h1>
        <p className="text-muted-foreground">Valide credenciais e teste rápido de criação de preferência</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mercado Pago</CardTitle>
          <CardDescription>Verifica variáveis de ambiente e executa um ping de preferência</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Button onClick={runCheck} disabled={loading} className="bg-brand-primary hover:bg-brand-primary/90">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Executar verificação
            </Button>
            {status?.test?.ok ? (
              <Badge className="bg-green-600">OK</Badge>
            ) : status ? (
              <Badge className="bg-red-600">Erro</Badge>
            ) : null}
          </div>

          {error && (
            <div className="mt-4 p-3 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-200 text-sm">
              {error}
            </div>
          )}

          {status && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h4 className="font-semibold">Ambiente</h4>
                <div className="text-sm">
                  <div>APP_URL configurado: {String(status.env.appUrlConfigured)}</div>
                  <div>APP_URL: {status.env.appUrl || '-'}</div>
                  <div>MP_ACCESS_TOKEN configurado: {String(status.env.accessTokenConfigured)}</div>
                  <div>Token (mascarado): <code>{status.env.tokenMasked}</code></div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Teste de Preferência</h4>
                {status.test.ok ? (
                  <div className="text-sm space-y-1">
                    <div>preference_id: {status.test.preference_id || '-'}</div>
                    <div>init_point: {status.test.init_point || '-'}</div>
                    <div className="text-xs text-muted-foreground">executado em {new Date(status.timestamp).toLocaleString()}</div>
                  </div>
                ) : (
                  <div className="text-sm space-y-1">
                    <div>erro: {status.test.error || '-'}</div>
                    {status.test.status !== undefined && status.test.status !== null && (
                      <div>status: {String(status.test.status)}</div>
                    )}
                    {status.test.code && (
                      <div>code: {String(status.test.code)}</div>
                    )}
                    {status.test.cause && (
                      <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(status.test.cause, null, 2)}</pre>
                    )}
                    <div className="text-xs text-muted-foreground">executado em {new Date(status.timestamp).toLocaleString()}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}