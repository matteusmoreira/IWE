"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { formatDateTime, formatDisplayLabel, formatDisplayValueByKey } from "@/lib/utils";

type Tenant = { id: string; name: string; slug: string };
type Template = { id: string; key: string; title: string; content: string; is_active: boolean };
type Submission = { id: string; tenant_id: string; data: any };

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
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<boolean>(false);
  const [scheduleAt, setScheduleAt] = useState<string>("");
  const [processing, setProcessing] = useState<boolean>(false);

  useEffect(() => {
    // Carregar tenants (RLS filtra automaticamente)
    fetch("/api/tenants").then(async (res) => {
      const data = await res.json();
      const ts: Tenant[] = data?.tenants || [];
      setTenants(ts);
      if (ts.length > 0) setTenantId(ts[0].id);
    }).catch(() => toast.error("Erro ao carregar polos"));
  }, []);

  useEffect(() => {
    // Carregar templates globais (apenas admin/superadmin)
    const controller = new AbortController();
    fetch(`/api/templates`, { signal: controller.signal })
      .then(async (res) => {
        const payload = await res.json();
        const items = (payload?.templates || []).map((t: any) => ({
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

  useEffect(() => {
    // Buscar submissions para seleção rápida por busca
    const controller = new AbortController();
    const q = new URLSearchParams();
    if (tenantId) q.set("tenant_id", tenantId);
    if (search) q.set("search", search);
    fetch(`/api/submissions?${q.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        const payload = await res.json();
        setSubmissions(payload?.submissions || []);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [tenantId, search]);

  const manualList = useMemo(() => {
    return recipientsManual
      .split(/\n|,|;|\s+/)
      .map(s => s.trim())
      .filter(Boolean);
  }, [recipientsManual]);

  async function handleSend() {
    try {
      if (!tenantId) { toast.error("Selecione um polo"); return; }
      setProcessing(true);

      const selectedSubs = submissions.filter(s => selectedSubmissionIds.includes(s.id));
      const phones = selectedSubs.map(s => s?.data?.telefone || s?.data?.phone).filter(Boolean);
      const emails = selectedSubs.map(s => s?.data?.email || s?.data?.contato_email || s?.data?.["e-mail"]).filter(Boolean);

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
        if (!res.ok) throw new Error("Falha ao enviar WhatsApp");
        toast.success("WhatsApp enviado");
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
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar");
    } finally {
      setProcessing(false);
    }
  }

  async function handleSchedule() {
    try {
      if (!tenantId) { toast.error("Selecione um polo"); return; }
      if (!scheduleAt) { toast.error("Defina data/hora do agendamento"); return; }
      setProcessing(true);
      const selectedSubs = submissions.filter(s => selectedSubmissionIds.includes(s.id));
      const phones = selectedSubs.map(s => s?.data?.telefone || s?.data?.phone).filter(Boolean);
      const emails = selectedSubs.map(s => s?.data?.email || s?.data?.contato_email || s?.data?.["e-mail"]).filter(Boolean);

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
    } catch (e: any) {
      toast.error(e?.message || "Erro ao agendar");
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
    } catch (e: any) {
      toast.error(e?.message || "Erro ao processar agendamentos");
    } finally { setProcessing(false); }
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold">Mensagens</h1>
        <Button variant="outline" onClick={handleProcessDue} disabled={processing}>Executar agendamentos vencidos</Button>
      </div>

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Polo</Label>
            <Select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="mt-1"
            >
              <option value="" disabled>Selecione</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Buscar alunos</Label>
            <Input placeholder="Nome, e-mail ou telefone" value={search} onChange={(e) => setSearch(e.target.value)} className="mt-1" />
            <div className="max-h-56 overflow-auto mt-2 border rounded">
              {submissions.map(s => {
                const buildPreview = (data: any): string => {
                  const prioritize = ["nome_completo","nome","name","whatsapp","telefone","phone","email","contato_email","e-mail"]; 
                  const keys = Array.from(new Set([...prioritize, ...Object.keys(data || {})]));
                  const pairs = keys
                    .filter(k => data && data[k] != null && String(data[k]).trim() !== "")
                    .slice(0, 2)
                    .map(k => `${formatDisplayLabel(k)}: ${formatDisplayValueByKey(k, data[k])}`);
                  return pairs.join(" • ") || "Aluno";
                };
                return (
                  <label key={s.id} className="flex items-center gap-2 p-2 border-b">
                    <input type="checkbox" checked={selectedSubmissionIds.includes(s.id)} onChange={(e) => {
                      setSelectedSubmissionIds(prev => e.target.checked ? [...prev, s.id] : prev.filter(id => id !== s.id));
                    }} />
                    <span className="text-sm">{buildPreview(s?.data)}</span>
                  </label>
                )
              })}
            </div>
          </div>
          <div>
            <Label>Destinatários manuais ({channel === "whatsapp" ? "telefones" : "e-mails"})</Label>
            <Textarea placeholder={channel === "whatsapp" ? "5511999999999, 11999999999" : "email@dominio.com, outro@dominio.com"} value={recipientsManual} onChange={(e) => setRecipientsManual(e.target.value)} className="mt-1" rows={6} />
          </div>
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
          <Button onClick={handleSend} disabled={processing}>Enviar agora</Button>
          <Button variant="secondary" onClick={handleSchedule} disabled={!schedule || processing}>Agendar</Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Dica: você pode usar placeholders como {"{{nome_completo}}"}, {"{{curso}}"}, {"{{valor}}"} se utilizar templates.
        </p>
        <p className="text-xs text-muted-foreground">Horário atual: {formatDateTime(new Date())}</p>
      </Card>
    </div>
  );
}