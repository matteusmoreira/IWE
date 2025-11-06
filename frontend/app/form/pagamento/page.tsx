"use client";

import { useState } from "react";

export default function PagamentoFormPage() {
  const [title, setTitle] = useState("Produto Teste");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(10);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!email || !email.includes("@")) {
      setError("Informe um e-mail válido.");
      return;
    }
    if (!title.trim()) {
      setError("Informe o título do produto.");
      return;
    }
    if (quantity <= 0 || unitPrice <= 0) {
      setError("Quantidade e preço devem ser maiores que zero.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/payments/mercadopago/create-preference", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, quantity, unit_price: unitPrice, email }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Falha ao criar preferência");
      }
      const data = await res.json();
      const initPoint = data?.init_point;
      if (!initPoint) throw new Error("Resposta sem init_point");
      window.location.href = initPoint;
    } catch (err: any) {
      setError(err?.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl p-4">
      <h1 className="text-2xl font-semibold mb-4">Pagamento via Mercado Pago</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Título do produto</label>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Quantidade</label>
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded border px-3 py-2"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value || "1", 10))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Preço unitário (BRL)</label>
            <input
              type="number"
              min={1}
              step={0.01}
              className="mt-1 w-full rounded border px-3 py-2"
              value={unitPrice}
              onChange={(e) => setUnitPrice(parseFloat(e.target.value || "0"))}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium">E-mail</label>
          <input
            type="email"
            className="mt-1 w-full rounded border px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {error && (
          <p className="text-red-600 text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Gerando preferência..." : "Pagar com Mercado Pago"}
        </button>
      </form>
    </div>
  );
}