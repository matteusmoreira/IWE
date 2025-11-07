Status de Integração (Dashboard)

Rota: /dashboard/status-integracao

Visibilidade: administradores (admin e superadmin).

O que faz:
- Exibe se APP_URL e MP_ACCESS_TOKEN estão configurados.
- Mostra o token mascarado (apenas os primeiros caracteres).
- Executa um teste de criação de preferência (binary_mode) e retorna OK/Erro com metadados.

Como usar:
1. Acesse o dashboard autenticado.
2. Abra "Status de Integração" no menu lateral (ou acesse diretamente a URL acima).
3. Clique em "Executar verificação" e confira o resultado.