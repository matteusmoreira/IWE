'use client';

import { useCallback, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function PagamentoFalhaPage() {
  const params = useSearchParams();
  const submissionId = params.get('submission_id');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const retryPayment = useCallback(async () => {
    if (!submissionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/payments/create-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: submissionId }),
      });
      const data = await res.json();
      if (res.ok && data?.init_point) {
        window.location.href = data.init_point;
      } else {
        const base = data?.error || 'Erro ao processar pagamento. Tente novamente.';
        const reason = data?.reason ? ` (${data.reason})` : '';
        const detail = data?.detail ? `: ${data.detail}` : '';
        const meta = data?.meta?.blocked_by || data?.meta?.code ? ` [${[data?.meta?.code, data?.meta?.blocked_by].filter(Boolean).join(' - ')}]` : '';
        setError(`${base}${reason}${detail}${meta}`);
      }
    } catch {
      setError('Erro ao processar pagamento. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  return (
    <div className="mx-auto max-w-xl p-4">
      <h1 className="text-2xl font-semibold mb-2">Pagamento falhou</h1>
      <p className="text-red-700 mb-4">O pagamento não foi aprovado. Tente novamente ou use outro método.</p>
      {submissionId && (
        <Button
          type="button"
          onClick={retryPayment}
          disabled={loading}
          className="w-full bg-red-600 text-black animate-pulse hover:bg-red-700 font-bold"
        >
          Retomar pagamento
        </Button>
      )}
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
    </div>
  );
}