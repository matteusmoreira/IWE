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
        toast({ title: "Erro", description: "Não foi possível carregar os templates." });
      })
      .finally(() => setLoading(false));
  }, []);

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
      toast({ title: "Template criado", description: "O template foi criado com sucesso." });
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
      toast({ title: "Erro", description: err?.message || "Falha ao criar template." });
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
      toast({ title: "Template atualizado", description: "Alterações salvas com sucesso." });
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
      toast({ title: "Erro", description: err?.message || "Falha ao salvar alterações." });
    }
  }

  async function deleteTemplate(t: Template) {
    if (!confirm(`Tem certeza que deseja excluir o template "${t.title}"?`)) return;
    try {
      const r = await fetch(`/api/templates/${t.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
      toast({ title: "Template excluído", description: "O template foi removido." });
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
      toast({ title: "Erro", description: err?.message || "Falha ao excluir template." });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Templates</h1>
        <Link href={`/dashboard/messages`} className="text-sm text-blue-600 underline">
          Ir para Mensagens
        </Link>
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
                <div key={t.id} className="border rounded p-4">
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
                      <div className="flex gap-2 mt-2 md:mt-0">
                        <Button variant="secondary" onClick={() => startEdit(t)}>Editar</Button>
                        <Button variant="destructive" onClick={() => deleteTemplate(t)}>Excluir</Button>
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
                      <div className="flex gap-2">
                        <Button onClick={() => saveEdit(t)}>Salvar</Button>
                        <Button variant="secondary" onClick={() => cancelEdit(t.id)}>Cancelar</Button>
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
