## Visão Geral
- Objetivo: transformar o frontend (`frontend/`) em PWA com instalação, cache básico e funcionamento offline limitado.
- Stack atual: Next.js 15 (App Router), React 19. Arquivos relevantes: `frontend/app/layout.tsx`, `frontend/next.config.ts`, `frontend/public/logo.png`.

## Escopo e Metas
- Instalação (Add to Home Screen) com `manifest.webmanifest` e ícones.
- Cache de assets estáticos e shell básico do app; páginas críticas (pagamentos, APIs Supabase) continuam online.
- Fallback offline simples para rotas não críticas.
- Registro de Service Worker com atualização silenciosa (skipWaiting+clientsClaim).

## Arquitetura
- Manifesto: `app/manifest.ts` expõe `/manifest.webmanifest` via Metadata Route do Next.
- Ícones: gerar `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-192.png`, `icon-maskable-512.png` a partir de `public/logo.png`.
- Service Worker: usar plugin `@ducanh2912/next-pwa` para Workbox e runtime caching.
- Registro SW: auto pelo plugin; opção de registro manual caso necessário.

## Fases de Implementação
### Fase 1 — Base PWA (manifesto + ícones)
1. Criar `frontend/app/manifest.ts` com `MetadataRoute.Manifest` (name, short_name, start_url `/`, display `standalone`, `theme_color` e `background_color`).
2. Adicionar ícones em `frontend/public/icons/` (192/512, maskable true/any). Referenciar no manifesto.
3. Atualizar `metadata` de `frontend/app/layout.tsx` para incluir `manifest: "/manifest.webmanifest"` (se necessário).

### Fase 2 — Service Worker e Cache
1. Instalar `@ducanh2912/next-pwa` e configurar em `frontend/next.config.ts` com `withPWA`:
   - `register: true`, `skipWaiting: true`, `cacheOnFrontEndNav: true`.
   - `runtimeCaching`: assets estáticos (`/_next/static/*`, fontes Google), imagens Supabase (host dinâmico já tratado em `next.config.ts:20-26`), e fallback offline para páginas não críticas.
   - `disable` em desenvolvimento via `process.env.NEXT_PUBLIC_PWA_ENABLE`.
2. Criar página de fallback offline mínima (`frontend/app/offline/page.tsx`) e mapear no Workbox.

### Fase 3 — UX de Instalação
1. Ouvir `beforeinstallprompt` no cliente e exibir botão “Instalar” opcional na UI (ex.: `frontend/app/dashboard/layout.tsx`).
2. Incluir meta tags opcionais para iOS (apple-touch-icon, status-bar-style) já parcialmente apontadas em `app/layout.tsx:15-20`.

### Fase 4 — Testes e Smoke
1. Verificar presença do manifesto em `GET /manifest.webmanifest` e ícones.
2. Confirmar registro de SW via DevTools e modo offline.
3. Testes automáticos (Playwright):
   - Checar que `/` carrega com `manifest` e `link rel="apple-touch-icon"`.
   - Simular offline e validar fallback em rota genérica.

## Variáveis de Ambiente
- `NEXT_PUBLIC_PWA_ENABLE` (default `false` em dev, `true` em prod) para habilitar o SW.

## Critérios de Aceite (Given–When–Then)
- Given usuário acessa `/`, When o app carrega, Then o navegador encontra `/manifest.webmanifest` com ícones válidos.
- Given o app em dispositivo suportado, When o usuário navega por algumas páginas, Then aparece opção de instalação do PWA (ou via menu do navegador).
- Given rede offline, When usuário acessa rota não crítica, Then o app exibe página offline e assets continuam disponíveis.
- Given nova versão, When o SW atualiza, Then a versão é ativada silenciosamente e o cache é renovado.

## Checklist de Segurança
- Não cachear respostas sensíveis (auth, dados pessoais) — apenas assets estáticos e imagens públicas.
- Respeitar `Cache-Control` das APIs externas (Supabase, Mercado Pago).
- Não armazenar tokens em cache; usar variáveis de ambiente (`NEXT_PUBLIC_*`) apenas para flags.

## Trade-offs e Rollback
- Plugin PWA oferece robustez, mas adiciona build-step; alternativa: SW manual com menor controle. Rollback: remover configuração do plugin e apagar SW gerado; manter apenas manifesto e ícones.

## Perguntas (máx. 2)
1. Preferência: plugin `@ducanh2912/next-pwa` (robusto) ou SW manual (leve)?
2. Escopo offline: somente shell+assets, ou incluir páginas de formulário de leitura?

## Próximo Passo Mínimo
- Criar `app/manifest.ts` e gerar ícones em `public/icons/`. Confirme para continuar.