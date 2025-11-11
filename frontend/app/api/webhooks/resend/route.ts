import { NextResponse } from "next/server";

// Segredo usado para validar a assinatura HMAC do webhook do Resend
const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

// Helper para comparar strings de forma segura (timing-safe-ish)
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function POST(request: Request) {
  if (!WEBHOOK_SECRET) {
    console.error("[Resend Webhook] RESEND_WEBHOOK_SECRET não configurado");
    return NextResponse.json({ error: "Webhook não configurado" }, { status: 500 });
  }

  const signature = request.headers.get("x-resend-signature") || "";
  const timestamp = request.headers.get("x-resend-timestamp") || "";

  if (!signature || !timestamp) {
    console.warn("[Resend Webhook] Assinatura ou timestamp ausentes");
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Garante que o webhook não é antigo demais (ex: 5 minutos)
  const now = Math.floor(Date.now() / 1000);
  const ts = Number(timestamp);
  const maxAgeSeconds = 5 * 60;

  if (!Number.isFinite(ts) || Math.abs(now - ts) > maxAgeSeconds) {
    console.warn("[Resend Webhook] Timestamp inválido ou expirado", { timestamp });
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const rawBody = await request.text();

  let expectedSignature: string;
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signed = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(`${timestamp}.${rawBody}`)
    );

    expectedSignature = Array.from(new Uint8Array(signed))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch (error) {
    console.error("[Resend Webhook] Erro ao calcular HMAC", error);
    return NextResponse.json({ error: "Erro na verificação" }, { status: 500 });
  }

  if (!safeEqual(signature, expectedSignature)) {
    console.warn("[Resend Webhook] Assinatura inválida");
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch (error) {
    console.warn("[Resend Webhook] Payload inválido", error);
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  console.log("[Resend Webhook] Evento recebido (verificado):", JSON.stringify(payload));

  return NextResponse.json({ received: true }, { status: 200 });
}