# 🚀 Como Enviar para o GitHub

## ⚠️ IMPORTANTE: Verificar Antes de Enviar

**ATENÇÃO:** Antes de fazer o push, certifique-se de que o arquivo `.env.local` NÃO será enviado!

O arquivo `frontend/.env.local` contém suas credenciais do Supabase e **NÃO deve ser commitado**.

Verifique que ele está no `.gitignore`:
```bash
cat .gitignore | Select-String "env.local"
```

Deve aparecer: `frontend/.env.local`

---

## 📝 Passo a Passo

### **1. Criar o Repositório no GitHub**

1. Acesse: https://github.com/new
2. **Repository name:** `saas-iwe` (ou outro nome)
3. **Description:** `SaaS de Educação Multi-tenant - IWE com integração Mercado Pago, WhatsApp e Moodle`
4. **Visibility:** Private (recomendado - suas credenciais ficarão protegidas)
5. ❌ **NÃO marque** "Initialize this repository with a README"
6. Clique em **Create repository**

### **2. Copiar a URL do Repositório**

Após criar, você verá uma página com comandos. Copie a URL HTTPS ou SSH:

**HTTPS:** `https://github.com/SEU-USUARIO/saas-iwe.git`  
**SSH:** `git@github.com:SEU-USUARIO/saas-iwe.git`

### **3. Conectar e Enviar**

Execute estes comandos no terminal (substitua a URL pela sua):

```bash
# Navegar até o projeto
cd "C:\Users\Matteus\Desktop\Saas IWE"

# Adicionar o repositório remoto
git remote add origin https://github.com/SEU-USUARIO/saas-iwe.git

# Renomear branch para main (padrão do GitHub)
git branch -M main

# Enviar o código
git push -u origin main
```

### **4. Verificar no GitHub**

1. Acesse: `https://github.com/SEU-USUARIO/saas-iwe`
2. Verifique se todos os arquivos foram enviados
3. **CONFIRME** que o arquivo `.env.local` **NÃO está lá**

---

## ✅ Comandos Prontos (Copie e Cole)

**ATENÇÃO:** Substitua `SEU-USUARIO` pelo seu username do GitHub!

```bash
cd "C:\Users\Matteus\Desktop\Saas IWE"
git remote add origin https://github.com/SEU-USUARIO/saas-iwe.git
git branch -M main
git push -u origin main
```

Se pedir autenticação:
- **Username:** seu username do GitHub
- **Password:** use um **Personal Access Token** (não a senha da conta)

### Como Criar um Personal Access Token:
1. Acesse: https://github.com/settings/tokens
2. Clique em **Generate new token** > **Classic**
3. Dê um nome: `SaaS IWE`
4. Marque: `repo` (acesso completo ao repositório)
5. Clique em **Generate token**
6. **COPIE O TOKEN** e use como senha ao fazer push

---

## 🔄 Comandos Futuros

Após o primeiro push, para enviar novas alterações:

```bash
# Ver o que mudou
git status

# Adicionar todas as mudanças
git add .

# Fazer commit
git commit -m "feat: descrição das mudanças"

# Enviar para o GitHub
git push
```

---

## 🛡️ Segurança

### ✅ O Que Será Enviado:
- ✅ Código-fonte
- ✅ Migrations SQL
- ✅ Documentação (README, SETUP_GUIDE, etc)
- ✅ `.env.local.example` (modelo sem credenciais)

### ❌ O Que NÃO Será Enviado:
- ❌ `frontend/.env.local` (com suas credenciais reais)
- ❌ `node_modules/` (dependências)
- ❌ `.next/` (build do Next.js)
- ❌ Arquivos temporários

---

## 🚨 Se Acidentalmente Enviar Credenciais

Se você commitou o `.env.local` por engano:

1. **Remova do histórico:**
```bash
git rm --cached frontend/.env.local
git commit -m "chore: remove credentials from git"
git push
```

2. **IMPORTANTE:** Regenere as credenciais no Supabase:
   - Acesse o Supabase Dashboard
   - Vá em Settings > API
   - Gere novas chaves

---

## 📞 Ajuda

Se tiver problemas:
- **Erro de autenticação:** Use Personal Access Token
- **Erro de permissão:** Verifique se o repositório é seu
- **Erro de merge:** Use `git push -f origin main` (cuidado!)

---

## 🎉 Pronto!

Após o push bem-sucedido, seu projeto estará no GitHub e você poderá:
- ✅ Acessar de qualquer lugar
- ✅ Colaborar com outras pessoas
- ✅ Fazer backup automático
- ✅ Usar GitHub Actions (CI/CD)

---

**Desenvolvido com ❤️ para IWE - Instituto Palavra da Fé**
