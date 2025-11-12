"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type Template = {
  id: string;
  tenant_id: string;
  key: string; // trigger_event/key
  title: string;
  content: string;
  variables: string[];
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

const PRESET_KEYS = [
  { value: "payment_approved", label: "Pagamento aprovado (WhatsApp)" },
  { value: "payment_approved_email", label: "Pagamento aprovado (E-mail)" },
  { value: "payment_reminder", label: "Lembrete de pagamento (WhatsApp)" },
  { value: "welcome", label: "Boas-vindas (WhatsApp)" },
  { value: "manual", label: "Manual (WhatsApp/E-mail)" },
];

function extractVariables(content: string): string[] {
  const vars = new Set<string>();
  const regex = /{{\s*([a-zA-Z0-9_\.]+)\s*}}/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    vars.add(match[1]);
  }
  return Array.from(vars);
}

export default function TemplatesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filterOnlyPayment, setFilterOnlyPayment] = useState<boolean>(true);
  // Forms (para sugerir placeholders)
  const [forms, setForms] = useState<any[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string>("");

  // Create form state
  const [newTitle, setNewTitle] = useState<string>("");
  const [newKey, setNewKey] = useState<string>(PRESET_KEYS[0].value);
  const [newActive, setNewActive] = useState<boolean>(true);
  const [newContent, setNewContent] = useState<string>("Olá {{nome_completo}}! Seu pagamento foi confirmado. Curso: {{curso}}. Polo: {{polo}}. Valor: {{valor}}.");

  // Edit state per template id
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [editState, setEditState] = useState<Record<string, Partial<Template>>>({});

  const filteredTemplates = useMemo(() => {
    if (!filterOnlyPayment) return templates;
    return templates.filter((t) => t.key === "payment_approved" || t.key === "payment_approved_email");
  }, [templates, filterOnlyPayment]);

  const keyAlreadyExists = useMemo(() => {
    return templates.some((t) => t.key === newKey);
  }, [templates, newKey]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/templates`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then((payload) => {
        const items = payload?.templates || [];
        const mapped: Template[] = items.map((t: any) => ({
          id: t.id,
          tenant_id: t.tenant_id,
          key: t.trigger_event ?? t.key,
          title: t.name ?? t.title,
          content: t.message_template ?? t.content,
          variables: t.variables ?? [],
          is_active: !!t.is_active,
          created_at: t.created_at,
        }));
        setTemplates(mapped);
      })
      .catch((err) => {
        console.error("Erro ao carregar templates", err);
        toast.error("Erro", { description: "Não foi possível carregar os templates." });
      })
      .finally(() => setLoading(false));
  }, []);

  // Carregar formulários para superadmin/admin (apenas nomes e campos)
  useEffect(() => {
    const loadForms = async () => {
      try {
        const r = await fetch('/api/forms');
        if (!r.ok) return; // Não bloquear a página se não carregar
        const payload = await r.json();
        const list = payload?.forms || [];
        setForms(list);
      } catch (e) {
        console.warn('Não foi possível carregar formulários para sugestão de placeholders');
      }
    };
    loadForms();
  }, []);

  const selectedForm = useMemo(() => forms.find((f: any) => String(f.id) === String(selectedFormId)), [forms, selectedFormId]);

  const suggestedPlaceholders = useMemo(() => {
    const f = selectedForm;
    if (!f?.form_fields) return [] as string[];
    const names = (f.form_fields || [])
      .filter((fld: any) => fld.is_active !== false)
      .map((fld: any) => String(fld.name || "").trim())
      .filter(Boolean);
    // variáveis especiais sempre disponíveis no pós-pagamento
    const special = ['polo', 'valor'];
    return Array.from(new Set([...names, ...special]));
  }, [selectedForm]);

  // Heurística simples para escolher campos típicos
  function pickFieldName(fields: any[], patterns: RegExp[], preferType?: string): string | undefined {
    if (!fields) return undefined;
    // 1) tentar por tipo
    if (preferType) {
      const byType = fields.find((f: any) => String(f.type).toLowerCase() === preferType);
      if (byType?.name) return byType.name;
    }
    // 2) tentar por padrões em name/label
    for (const p of patterns) {
      const hit = fields.find((f: any) => p.test(String(f.name)) || p.test(String(f.label)));
      if (hit?.name) return hit.name;
    }
    // 3) fallback: primeiro campo texto
    const textField = fields.find((f: any) => String(f.type).toLowerCase() === 'text');
    if (textField?.name) return textField.name;
    return undefined;
  }

  function applyAutoFixPlaceholders() {
    const fields = selectedForm?.form_fields || [];
    const nameField = pickFieldName(fields, [/nome_completo/i, /nome/i, /name/i]);
    const courseField = pickFieldName(fields, [/curso/i, /course/i]);
    // telefone pode ser usado no disparo de WhatsApp, mas não é necessário no conteúdo
    const baseSaudacao = `Olá {{${nameField || 'nome_completo'}}}! Seu pagamento foi confirmado.`;
    const cursoParte = courseField ? ` Curso: {{${courseField}}}.` : '';
    const extras = ` Polo: {{polo}}. Valor: {{valor}}.`;
    const content = `${baseSaudacao}${cursoParte}${extras}`;
    setNewContent(content);
    toast.info('Placeholders ajustados', { description: 'Conteúdo atualizado com os campos do formulário selecionado.' });
  }

  async function onCreateTemplate() {
    const variables = extractVariables(newContent);
    try {
      const r = await fetch(`/api/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTitle || "",
          trigger_event: newKey,
          message_template: newContent,
          is_active: newActive,
          variables,
        }),
      });
      if (!r.ok) {
        const msg = await r.text();
        throw new Error(msg);
      }
      toast.success("Template criado", { description: "O template foi criado com sucesso." });
      // reset básico
      setNewTitle("");
      setNewKey(PRESET_KEYS[0].value);
      setNewActive(true);
      setNewContent("Olá {{nome_completo}}! Seu pagamento foi confirmado. Curso: {{curso}}. Polo: {{polo}}. Valor: {{valor}}.");
      // reload
      const refreshed = await fetch(`/api/templates`);
      const payload = await refreshed.json();
      const items = payload?.templates || [];
      setTemplates(items.map((t: any) => ({
        id: t.id,
        tenant_id: t.tenant_id,
        key: t.trigger_event ?? t.key,
        title: t.name ?? t.title,
        content: t.message_template ?? t.content,
        variables: t.variables ?? [],
        is_active: !!t.is_active,
        created_at: t.created_at,
      })));
    } catch (err: any) {
      console.error("Erro ao criar template", err);
      toast.error("Erro", { description: err?.message || "Falha ao criar template." });
    }
  }

  function startEdit(t: Template) {
    setEditing((prev) => ({ ...prev, [t.id]: true }));
    setEditState((prev) => ({
      ...prev,
      [t.id]: {
        title: t.title,
        key: t.key,
        is_active: t.is_active,
        content: t.content,
      },
    }));
  }

  function cancelEdit(id: string) {
    setEditing((prev) => ({ ...prev, [id]: false }));
    setEditState((prev) => ({ ...prev, [id]: {} }));
  }

  async function saveEdit(t: Template) {
    const changes = editState[t.id] || {};
    const content = String(changes.content ?? t.content);
    const variables = extractVariables(content);
    try {
      const r = await fetch(`/api/templates/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: changes.title ?? t.title,
          trigger_event: changes.key ?? t.key,
          content,
          is_active: changes.is_active ?? t.is_active,
          variables,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      toast.success("Template atualizado", { description: "Alterações salvas com sucesso." });
      // reload
      const refreshed = await fetch(`/api/templates`);
      const payload = await refreshed.json();
      const items = payload?.templates || [];
      setTemplates(items.map((t: any) => ({
        id: t.id,
        tenant_id: t.tenant_id,
        key: t.trigger_event ?? t.key,
        title: t.name ?? t.title,
        content: t.message_template ?? t.content,
        variables: t.variables ?? [],
        is_active: !!t.is_active,
        created_at: t.created_at,
      })));
      cancelEdit(t.id);
    } catch (err: any) {
      console.error("Erro ao atualizar template", err);
      toast.error("Erro", { description: err?.message || "Falha ao salvar alterações." });
    }
  }

  async function deleteTemplate(t: Template) {
    if (!confirm(`Tem certeza que deseja excluir o template "${t.title}"?`)) return;
    try {
      const r = await fetch(`/api/templates/${t.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
      toast.success("Template excluído", { description: "O template foi removido." });
      // reload
      const refreshed = await fetch(`/api/templates`);
      const payload = await refreshed.json();
      const items = payload?.templates || [];
      setTemplates(items.map((t: any) => ({
        id: t.id,
        tenant_id: t.tenant_id,
        key: t.trigger_event ?? t.key,
        title: t.name ?? t.title,
        content: t.message_template ?? t.content,
        variables: t.variables ?? [],
        is_active: !!t.is_active,
        created_at: t.created_at,
      })));
    } catch (err: any) {
      console.error("Erro ao excluir template", err);
      toast.error("Erro", { description: err?.message || "Falha ao excluir template." });
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-0">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <h1 className="text-2xl font-semibold text-center md:text-left">Templates</h1>
        <div className="w-full md:w-auto flex justify-center">
          <Link href={`/dashboard/messages`} className="text-sm text-blue-600 underline">
            Ir para Mensagens
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Switch checked={filterOnlyPayment} onCheckedChange={setFilterOnlyPayment} />
            <Label>Mostrar apenas templates de pós-pagamento</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Criar novo template</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Título</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ex.: Pagamento Aprovado" />
            </div>
            <div>
              <Label>Disparo/Chave</Label>
              <Select
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="mt-1"
              >
                {PRESET_KEYS.map((k) => (
                  <option key={k.value} value={k.value}>{k.label}</option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={newActive} onCheckedChange={setNewActive} />
              <Label>Ativo</Label>
            </div>
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 border rounded p-3">
              <div className="md:col-span-1">
                <Label>Formulário de referência (opcional)</Label>
                <Select
                  value={selectedFormId}
                  onChange={(e) => setSelectedFormId(e.target.value)}
                  className="mt-1"
                >
                  <option value="">Selecionar…</option>
                  {forms.map((f: any) => (
                    <option key={f.id} value={f.id}>{f.name} {f.tenants?.name ? `(${f.tenants.name})` : '(Global)'}</option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground mt-2">Sugestão rápida: escolha o formulário usado na cobrança para preencher os placeholders corretos.</p>
              </div>
              <div className="md:col-span-2">
                <Label>Placeholders sugeridos</Label>
                <div className="text-sm mt-1">
                  {suggestedPlaceholders.length > 0 ? suggestedPlaceholders.join(', ') : 'Selecione um formulário para ver sugestões.'}
                </div>
                <div className="mt-2">
                  <Button variant="secondary" onClick={applyAutoFixPlaceholders} disabled={!selectedFormId}>Corrigir placeholders automaticamente</Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Observação: "polo" e "valor" são variáveis especiais do fluxo de pós-pagamento e sempre estão disponíveis.</p>
              </div>
            </div>
            <div className="md:col-span-2">
              <Label>Conteúdo</Label>
              <Textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={8}
                placeholder="Use placeholders como {{nome_completo}}, {{curso}}, {{polo}}, {{valor}}"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Placeholders detectados: {extractVariables(newContent).join(", ") || "nenhum"}
              </p>
            </div>
            <div>
              <Button onClick={onCreateTemplate} disabled={keyAlreadyExists}>Criar template</Button>
              {keyAlreadyExists && (
                <p className="text-xs text-red-600 mt-1">Já existe um template global com essa chave. Edite o existente ou escolha outra chave.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Templates existentes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Carregando...</p>
          ) : filteredTemplates.length === 0 ? (
            <p>Nenhum template encontrado.</p>
          ) : (
            <div className="space-y-4">
              {filteredTemplates.map((t) => (
                <div key={t.id} className="border rounded p-4 overflow-hidden">
                  {!editing[t.id] ? (
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-start">
                      <div className="md:col-span-2">
                        <p className="font-medium">{t.title}</p>
                        <p className="text-xs text-muted-foreground">Chave: {t.key}</p>
                        <p className="text-xs text-muted-foreground">Ativo: {t.is_active ? "Sim" : "Não"}</p>
                        <p className="text-xs text-muted-foreground">Placeholders: {t.variables?.join(", ") || "-"}</p>
                      </div>
                      <div className="md:col-span-3">
                        <pre className="text-sm whitespace-pre-wrap">{t.content}</pre>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mt-2 md:mt-0">
                        <Button variant="secondary" onClick={() => startEdit(t)} className="w-full sm:w-auto">Editar</Button>
                        <Button variant="destructive" onClick={() => deleteTemplate(t)} className="w-full sm:w-auto">Excluir</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Título</Label>
                          <Input
                            value={String(editState[t.id]?.title ?? t.title)}
                            onChange={(e) => setEditState((prev) => ({ ...prev, [t.id]: { ...prev[t.id], title: e.target.value } }))}
                          />
                        </div>
                        <div>
                          <Label>Disparo/Chave</Label>
                          <Select
                            value={String(editState[t.id]?.key ?? t.key)}
                            onChange={(e) => setEditState((prev) => ({ ...prev, [t.id]: { ...prev[t.id], key: e.target.value } }))}
                            className="mt-1"
                          >
                            {PRESET_KEYS.map((k) => (
                              <option key={k.value} value={k.value}>{k.label}</option>
                            ))}
                          </Select>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={Boolean(editState[t.id]?.is_active ?? t.is_active)}
                            onCheckedChange={(v) => setEditState((prev) => ({ ...prev, [t.id]: { ...prev[t.id], is_active: v } }))}
                          />
                          <Label>Ativo</Label>
                        </div>
                        <div className="md:col-span-2">
                          <Label>Conteúdo</Label>
                          <Textarea
                            value={String(editState[t.id]?.content ?? t.content)}
                            onChange={(e) => setEditState((prev) => ({ ...prev, [t.id]: { ...prev[t.id], content: e.target.value } }))}
                            rows={8}
                          />
                          <p className="text-xs text-muted-foreground mt-2">
                            Placeholders detectados: {extractVariables(String(editState[t.id]?.content ?? t.content)).join(", ") || "nenhum"}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
                        <Button onClick={() => saveEdit(t)} className="w-full sm:w-auto">Salvar</Button>
                        <Button variant="secondary" onClick={() => cancelEdit(t.id)} className="w-full sm:w-auto">Cancelar</Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        Dica: Os templates de pós-pagamento usados automaticamente são "payment_approved" (WhatsApp) e "payment_approved_email" (E-mail).
      </div>
    </div>
  );
}
