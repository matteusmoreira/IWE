"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Error boundary do segmento /dashboard
// Mostra mensagem amigável e opção de recarregar quando ocorrer uma falha em runtime.
export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error("Erro no dashboard:", error);
  }, [error]);

  const handleReload = () => {
    // Tenta resetar estado do React primeiro
    try {
      reset();
    } catch {}
    // Faz um reload completo.
    window.location.reload();
  };

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="max-w-md w-full rounded-lg border border-border bg-card p-6 text-center">
        <h2 className="text-xl font-semibold mb-2">Não foi possível carregar o dashboard</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Ocorreu um erro ao carregar recursos da página. Isso pode acontecer após uma atualização do servidor.
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={handleReload}>Recarregar página</Button>
          <Button variant="outline" onClick={() => reset()}>Tentar novamente</Button>
        </div>
      </div>
    </div>
  );
}