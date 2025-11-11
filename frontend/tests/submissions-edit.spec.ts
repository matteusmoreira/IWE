import { test, expect } from '@playwright/test';

// Configuração via variáveis de ambiente (não exibir segredos em logs)
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const STORAGE_STATE = process.env.STORAGE_STATE; // opcional: caminho para JSON de sessão logada
const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL; // recomendado: definir em ambiente local
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD; // recomendado: definir em ambiente local

// Se houver storage state, usamos para todos os testes
if (STORAGE_STATE) {
  test.use({ storageState: STORAGE_STATE });
}

async function loginIfNeeded(page: import('@playwright/test').Page) {
  // Se já há storage state, assume logado
  if (STORAGE_STATE) return;

  if (!SUPERADMIN_EMAIL || !SUPERADMIN_PASSWORD) {
    test.skip(true, 'Faltam SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD no ambiente para login');
  }

  await page.goto(`${BASE_URL}/auth/login`);
  await page.fill('#email', SUPERADMIN_EMAIL!);
  await page.fill('#password', SUPERADMIN_PASSWORD!);
  await page.getByRole('button', { name: 'Entrar' }).click();
  // Aguarda carregamento e tenta ir direto ao dashboard
  await page.waitForLoadState('networkidle', { timeout: 20000 });
  await page.goto(`${BASE_URL}/dashboard`);
  // Se ainda estiver no login, aborta com skip
  const stillOnLogin = await page.locator('#email').count();
  if (stillOnLogin) {
    test.skip(true, 'Login não foi concluído com sucesso. Verifique credenciais e Supabase.');
  }
}

test('Editar status de pagamento do primeiro aluno para Pago (se disponível)', async ({ page }) => {
  // 1) Login
  await loginIfNeeded(page);

  // 2) Ir para Submissões
  await page.goto(`${BASE_URL}/dashboard/submissions`);
  await expect(page.getByText('Alunos')).toBeVisible();

  // 3) Encontrar primeira linha
  const rows = page.locator('table tbody tr');
  const count = await rows.count();
  if (count < 1) {
    test.skip(true, 'Nenhuma submissão disponível para edição.');
  }

  const firstRow = rows.first();

  // 4) Abrir diálogo de edição (apenas para admin/superadmin)
  const editBtn = firstRow.locator('button[title="Editar status de pagamento"]');
  if (await editBtn.count() === 0) {
    test.skip(true, 'Botão de edição não disponível (papel ou UI)');
  }
  await editBtn.click();

  // 5) Selecionar novo status
  const statusSelect = page.locator('select');
  await expect(statusSelect).toBeVisible();
  await statusSelect.selectOption('PAGO');

  // 6) Salvar
  await page.getByRole('button', { name: 'Salvar' }).click();

  // 7) Verificar badge atualizado na mesma linha
  const headers = await page.locator('table thead th').allInnerTexts();
  const paymentIdx = headers.findIndex((h) => h.trim() === 'Pagamento');
  const paymentCell = paymentIdx >= 0 ? firstRow.locator('td').nth(paymentIdx) : firstRow.locator('td').nth(4);
  await expect(paymentCell.getByText('Pago')).toBeVisible({ timeout: 15000 });
});