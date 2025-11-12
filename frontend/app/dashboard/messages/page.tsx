"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { formatDateTime, formatDisplayLabel, formatDisplayValueByKey } from "@/lib/utils";
import { formatCEP, formatPhone as maskPhone, formatRG } from "@/lib/masks";

type Tenant = { id: string; name: string; slug: string };
type Template = { id: string; key: string; title: string; content: string; is_active: boolean };
type Submission = { id: string; tenant_id: string; data: any; tenants?: { id: string; name: string; slug: string } };

export default function MessagesPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState<string>("");
  const [channel, setChannel] = useState<"whatsapp" | "email">("whatsapp");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [html, setHtml] = useState<string>("");
  const [recipientsManual, setRecipientsManual] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  // Paginação
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);
  const [total, setTotal] = useState<number>(0);
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<string[]>([]);
  // Visualização (lista ou grade)
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [schedule, setSchedule] = useState<boolean>(false);
  const [scheduleAt, setScheduleAt] = useState<string>("");
  const [processing, setProcessing] = useState<boolean>(false);
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [loadingSubmissions, setLoadingSubmissions] = useState<boolean>(false);

  // Helpers para extrair valores por chaves exatas ou por substring
  const getValueByKeys = (keys: string[], data: Record<string, unknown>) => {
    for (const k of keys) {
      const v = (data as any)?.[k];
      if (v != null && String(v).trim() !== "") return String(v);
    }
    return "";
  };
  const getValueByContains = (substrings: string[], data: Record<string, unknown>) => {
    const entries = Object.entries(data || {});
    for (const [key, val] of entries) {
      const lk = String(key).toLowerCase();
      if (substrings.some(sub => lk.includes(sub))) {
        const v = val != null ? String(val).trim() : '';
        if (v) return v;
      }
    }
    return "";
  };
  const extractPhone = (data: Record<string, unknown>) => (
    getValueByKeys(["whatsapp","telefone","phone","celular"], data) ||
    getValueByContains(["whats","zap","tel","fone","cel","telefone","celular","phone"], data)
  );
  const extractEmail = (data: Record<string, unknown>) => (
    getValueByKeys(["email","contato_email","e-mail"], data) ||
    getValueByContains(["email","e-mail","mail"], data)
  );

  useEffect(() => {
    // Carregar tenants (RLS filtra automaticamente)
    fetch("/api/tenants").then(async (res) => {
      const data = await res.json();
      const ts: Tenant[] = data?.tenants || [];
      setTenants(ts);
      if (ts.length > 0) setTenantId(ts[0].id);
    }).catch(() => toast.error("Erro ao carregar dados"));
  }, []);

  useEffect(() => {
    // Carregar templates globais (apenas admin/superadmin)
    const controller = new AbortController();
    fetch(`/api/templates`, { signal: controller.signal })
      .then(async (res) => {
        const payload = await res.json();
        const items = (payload?.templates || []).map((t: {
          id: string;
          trigger_event: string;
          name: string;
          message_template: string;
          is_active?: boolean;
        }) => ({
          id: t.id,
          key: t.trigger_event,
          title: t.name,
          content: t.message_template,
          is_active: !!t.is_active,
        })) as Template[];
        setTemplates(items.filter(t => t.is_active));
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // Debounce da busca para evitar excesso de requisições
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    // Buscar submissions com paginação. Quando a busca é vazia, lista geral; quando há termo, filtra no servidor.
    const controller = new AbortController();
    const q = new URLSearchParams();
    const offset = (page - 1) * limit;
    q.set("limit", String(limit));
    q.set("offset", String(offset));
    if (debouncedSearch) q.set("search", debouncedSearch);

    setLoadingSubmissions(true);
    fetch(`/api/submissions?${q.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const payload = await res.json();
        const list = payload?.submissions || [];
        setSubmissions(list);
        setTotal(Number(payload?.total ?? 0));
      })
      .catch(() => {})
      .finally(() => setLoadingSubmissions(false));
    return () => controller.abort();
  }, [debouncedSearch, page, limit]);

  // Ao mudar o termo de busca, sempre voltar para página 1
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Mantém seleção apenas quando a lista muda

  const manualList = useMemo(() => {
    return recipientsManual
      .split(/\n|,|;|\s+/)
      .map(s => s.trim())
      .filter(Boolean);
  }, [recipientsManual]);

  // Seleção atual e contagem de destinatários (para desabilitar botões quando vazio)
  const selectedSubsMemo = useMemo(() => submissions.filter(s => selectedSubmissionIds.includes(s.id)), [submissions, selectedSubmissionIds]);
  const selectedPhonesMemo = useMemo(() => selectedSubsMemo
    .map(s => extractPhone(s?.data || {}))
    .map(v => String(v).trim())
    .filter(Boolean), [selectedSubsMemo]);
  const selectedEmailsMemo = useMemo(() => selectedSubsMemo
    .map(s => extractEmail(s?.data || {}))
    .map(v => String(v).trim())
    .filter(Boolean), [selectedSubsMemo]);
  const recipientsCount = useMemo(() => {
    return channel === 'whatsapp'
      ? [...selectedPhonesMemo, ...manualList].filter(Boolean).length
      : [...selectedEmailsMemo, ...manualList].filter(Boolean).length;
  }, [channel, selectedPhonesMemo, selectedEmailsMemo, manualList]);

  async function handleSend() {
    try {
      setProcessing(true);

      const selectedSubs = submissions.filter(s => selectedSubmissionIds.includes(s.id));
      // Extrai telefones e e-mails considerando variações comuns nos formulários
      const phones = selectedSubs
        .map(s => extractPhone(s?.data || {}))
        .map(v => String(v).trim())
        .filter(Boolean);
      const emails = selectedSubs
        .map(s => extractEmail(s?.data || {}))
        .map(v => String(v).trim())
        .filter(Boolean);

      if (channel === "whatsapp") {
        const body = {
          tenant_id: tenantId,
          to: [...phones, ...manualList].filter(Boolean),
          template_key: selectedTemplate || undefined,
          message: message || undefined,
          variables: {},
        };
        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || "Falha ao enviar WhatsApp");
        // Feedback mais claro: informa sucessos e falhas
        const success = Number(payload?.success ?? 0);
        const failures = Number(payload?.failures ?? 0);
        if (success === 0) {
          toast.error(`Nenhuma mensagem enviada. Falhas: ${failures}`);
        } else if (failures > 0) {
          toast.success(`WhatsApp enviado para ${success} destinatário(s). Falhas: ${failures}`);
        } else {
          toast.success(`WhatsApp enviado para ${success} destinatário(s).`);
        }
      } else {
        const body = {
          tenant_id: tenantId,
          to: [...emails, ...manualList].filter(Boolean),
          subject: subject || "Mensagem",
          html: html || message,
          template_key: selectedTemplate || undefined,
          variables: {},
        };
        const res = await fetch("/api/emails/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Falha ao enviar E-mail");
        toast.success("E-mail enviado");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao enviar";
      toast.error(msg);
    } finally {
      setProcessing(false);
    }
  }

  async function handleSchedule() {
    try {
      if (!scheduleAt) { toast.error("Defina data/hora do agendamento"); return; }
      setProcessing(true);
      const selectedSubs = submissions.filter(s => selectedSubmissionIds.includes(s.id));
      const phones = selectedSubs
        .map(s => extractPhone(s?.data || {}))
        .map(v => String(v).trim())
        .filter(Boolean);
      const emails = selectedSubs
        .map(s => extractEmail(s?.data || {})) 
        .map(v => String(v).trim())
        .filter(Boolean);

      const body: any = {
        tenant_id: tenantId,
        channel,
        scheduled_for: scheduleAt,
        variables: {},
        metadata: {},
      };
      if (channel === "whatsapp") {
        body.recipient_phones = [...phones, ...manualList].filter(Boolean);
        body.template_key = selectedTemplate || undefined;
        body.message = message || undefined;
      } else {
        body.to = [...emails, ...manualList].filter(Boolean);
        body.subject = subject || "Mensagem";
        body.html = html || message;
        body.template_key = selectedTemplate || undefined;
      }

      const res = await fetch("/api/messages/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Falha ao agendar");
      toast.success("Agendado com sucesso");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao agendar";
      toast.error(msg);
    } finally {
      setProcessing(false);
    }
  }

  async function handleProcessDue() {
    try {
      setProcessing(true);
      const res = await fetch("/api/messages/process-scheduled", { method: "POST" });
      if (!res.ok) throw new Error("Falha ao processar agendamentos");
      const payload = await res.json();
      toast.success(`Processados: ${payload?.processed ?? 0}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao processar agendamentos";
      toast.error(msg);
    } finally { setProcessing(false); }
  }

  // Normalização para comparação (remove acentos e coloca em minúsculas)
  const normalizeText = (s: string) => s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  // Extrator de nome (reutiliza helpers já usados no render)
  const extractName = (data: Record<string, unknown>) => (
    getValueByKeys(["nome_completo","nome","name"], data)
    || getValueByContains(["nome","aluno","name"], data)
  );

  // Lista final é a própria resposta da API (paginação e busca já aplicadas)
  const renderedSubmissions = submissions;

  return (
    <div className="p-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
        <h1 className="text-xl font-semibold text-center md:text-left">Mensagens</h1>
        <div className="w-full md:w-auto flex justify-center">
          <Button variant="outline" onClick={handleProcessDue} disabled={processing}>Executar agendamentos vencidos</Button>
        </div>
      </div>

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Canal</Label>
            <Select
              value={channel}
              onChange={(e) => setChannel(e.target.value as any)}
              className="mt-1"
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="email">E-mail</option>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex items-center gap-2 mt-6">
              <Switch checked={schedule} onCheckedChange={setSchedule} />
              <span>Agendar</span>
            </div>
            {schedule && (
              <Input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
            )}
          </div>
        </div>
      </Card>

      <Card className="p-4 mb-4">
        <div>
          <Label>Buscar alunos</Label>
          <Input placeholder="Nome, e-mail ou telefone" autoComplete="off" value={search} onChange={(e) => setSearch(e.target.value)} className="mt-1" />
          {/* Alternador de visualização */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-muted-foreground">Visualização:</span>
            <div className="flex gap-1">
              <Button type="button" size="sm" variant={viewMode === 'list' ? 'default' : 'outline'} onClick={() => setViewMode('list')}>Lista</Button>
              <Button type="button" size="sm" variant={viewMode === 'grid' ? 'default' : 'outline'} onClick={() => setViewMode('grid')}>Grade</Button>
            </div>
          </div>

          <div className={`max-h-96 md:max-h-[480px] overflow-auto mt-2 border rounded ${viewMode === 'grid' ? 'p-2' : ''} ${viewMode === 'list' ? 'divide-y' : ''} ${viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2' : ''}`}>
            {loadingSubmissions && (
              <div className="p-2 text-sm text-muted-foreground">Carregando alunos...</div>
            )}
            {!loadingSubmissions && renderedSubmissions.length === 0 && (
              <div className="p-2 text-sm text-muted-foreground">Nenhum aluno encontrado.</div>
            )}
            {!loadingSubmissions && renderedSubmissions.map(s => {
              // Extratores simples com chaves exatas e busca por substring
              const getValueByKeys = (keys: string[], data: Record<string, unknown>) => {
                for (const k of keys) {
                  const v = (data as any)?.[k];
                  if (v != null && String(v).trim() !== "") return String(v);
                }
                return "";
              };
              const getValueByContains = (substrings: string[], data: Record<string, unknown>) => {
                const entries = Object.entries(data || {});
                for (const [key, val] of entries) {
                  const lk = String(key).toLowerCase();
                  if (substrings.some(sub => lk.includes(sub))) {
                    const v = val != null ? String(val).trim() : '';
                    if (v) return v;
                  }
                }
                return "";
              };

              const data = (s?.data || {}) as Record<string, unknown>;
              const name = getValueByKeys(["nome_completo","nome","name"], data)
                || getValueByContains(["nome","aluno","name"], data);
              const phoneRaw = getValueByKeys(["whatsapp","telefone","phone","celular"], data)
                || getValueByContains(["whats","zap","tel","fone","cel","telefone","celular","phone"], data);
              const poloFromData = getValueByKeys(["polo","polo_nome","poloName"], data)
                || getValueByContains(["polo"], data);
              const polo = poloFromData || (s as any)?.tenants?.name || "";

              const id = `submission-${s.id}`;
              if (viewMode === 'grid') {
                return (
                  <label key={s.id} htmlFor={id} className="group block rounded border p-3 hover:bg-muted/40 transition-colors cursor-pointer">
                    <div className="flex items-start gap-3">
                      <input
                        id={id}
                        type="checkbox"
                        className="mt-1"
                        checked={selectedSubmissionIds.includes(s.id)}
                        onChange={(e) => {
                          setSelectedSubmissionIds(prev => e.target.checked ? [...prev, s.id] : prev.filter(id => id !== s.id));
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm truncate">{name || "Aluno"}</span>
                          {polo && (
                            <Badge variant="outline" className="text-[10px]">Polo: {polo}</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 truncate">
                          {phoneRaw && (
                            <span>WhatsApp: {maskPhone(phoneRaw)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </label>
                );
              }
              // Modo lista (padrão)
              return (
                <label key={s.id} htmlFor={id} className="flex items-center gap-2 p-2 cursor-pointer">
                  <input
                    id={id}
                    type="checkbox"
                    checked={selectedSubmissionIds.includes(s.id)}
                    onChange={(e) => {
                      setSelectedSubmissionIds(prev => e.target.checked ? [...prev, s.id] : prev.filter(id => id !== s.id));
                    }}
                  />
                  <span className="text-sm truncate">
                    <span className="font-semibold">{name || "Aluno"}</span>
                    {phoneRaw && (
                      <span className="font-semibold"> • WhatsApp: {maskPhone(phoneRaw)}</span>
                    )}
                    {polo && (
                      <span className="font-semibold"> • Polo: {polo}</span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
          {/* Controles de paginação */}
          <div className="flex items-center justify-between mt-2">
            <div className="text-xs text-muted-foreground">Página {Math.max(1, page)} de {Math.max(1, Math.ceil(total / limit) || 1)}</div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loadingSubmissions}
              >Anterior</Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(total / limit) || loadingSubmissions}
              >Próxima</Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Card separado para destinatários manuais */}
      <Card className="p-4 mb-4">
        <div>
          <Label>Destinatários manuais ({channel === "whatsapp" ? "telefones" : "e-mails"})</Label>
          <Textarea placeholder={channel === "whatsapp" ? "5511999999999, 11999999999" : "email@dominio.com, outro@dominio.com"} value={recipientsManual} onChange={(e) => setRecipientsManual(e.target.value)} className="mt-1" rows={6} />
        </div>
      </Card>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Template (opcional)</Label>
            <Select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="mt-1"
            >
              <option value="">Selecione</option>
              {templates.map(t => (
                <option key={t.id} value={t.key}>{t.title}</option>
              ))}
            </Select>
            <div className="mt-2">
              <a href="/dashboard/templates" className="text-xs text-blue-600 underline">Gerenciar Templates</a>
            </div>
          </div>

          {channel === "email" && (
            <div>
              <Label>Assunto</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1" />
            </div>
          )}
        </div>

        {channel === "email" ? (
          <div className="mt-4">
            <Label>HTML</Label>
            <Textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={8} className="mt-1" />
          </div>
        ) : (
          <div className="mt-4">
            <Label>Mensagem</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} className="mt-1" />
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <Button onClick={handleSend} disabled={processing || recipientsCount === 0}>Enviar agora</Button>
          <Button variant="secondary" onClick={handleSchedule} disabled={!schedule || processing || recipientsCount === 0}>Agendar</Button>
        </div>
        {recipientsCount === 0 && (
          <p className="text-xs text-red-600 mt-1">Selecione pelo menos 1 destinatário ou informe manualmente.</p>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          Dica: você pode usar placeholders como {"{{nome_completo}}"}, {"{{curso}}"}, {"{{valor}}"} se utilizar templates.
        </p>
        <p className="text-xs text-muted-foreground">Horário atual: {formatDateTime(new Date())}</p>
      </Card>
    </div>
  );
}
