'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, Trash2, Loader2, Search, Download, Filter, File as FileIcon, FileText, FileImage, FileSpreadsheet, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate, formatDisplayLabel, formatDisplayValue, formatDisplayValueByKey, formatPhone } from '@/lib/utils';

interface Submission {
  id: string;
  data: Record<string, any>;
  payment_status: string;
  payment_amount: number | null;
  created_at: string;
  tenants: {
    id: string;
    name: string;
    slug: string;
  };
  form_definitions: {
    id: string;
    name: string;
  };
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSubmission, setDeletingSubmission] = useState<Submission | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showDocumentColumn, setShowDocumentColumn] = useState(true);

  // Helpers locais para metadados de arquivo
  type FileMeta = { name: string; size?: number; type?: string; url?: string; storagePath?: string };

  const isFileMeta = (v: any): v is FileMeta => {
    return v && typeof v === 'object' && 'name' in v && (('type' in v) || ('size' in v));
  };

  const getExtension = (name?: string) => {
    if (!name) return '';
    const parts = name.split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
  };

  const detectFileType = (meta?: FileMeta) => {
    const mime = meta?.type?.toLowerCase() || '';
    const ext = getExtension(meta?.name);
    if (mime.includes('pdf') || ext === 'pdf') return 'pdf';
    if (mime.includes('image/') || ['png','jpg','jpeg','gif','webp'].includes(ext)) return 'image';
    if (mime.includes('sheet') || ['xls','xlsx','csv'].includes(ext)) return 'xls';
    if (mime.includes('word') || ['doc','docx'].includes(ext)) return 'doc';
    return 'other';
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '-';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${sizes[i]}`;
  };

  const pickIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return FileText;
      case 'doc':
        return FileText;
      case 'image':
        return FileImage;
      case 'xls':
        return FileSpreadsheet;
      default:
        return FileIcon;
    }
  };

  const findFirstFileMeta = (data: Record<string, any>): FileMeta | null => {
    for (const key of Object.keys(data || {})) {
      const val = data[key];
      if (isFileMeta(val)) return val as FileMeta;
      // Caso alguns projetos salvem como array
      if (Array.isArray(val)) {
        const first = val.find((v) => isFileMeta(v));
        if (first) return first as FileMeta;
      }
    }
    return null;
  };

  // Componente que resolve Signed URL e exibe href com domínio do Supabase
  type IconType = React.ComponentType<{ className?: string }>;
  const DocumentAnchor = ({
    storagePath,
    label,
    Icon,
    className,
    title,
  }: {
    storagePath: string;
    label: string;
    Icon: IconType;
    className?: string;
    title?: string;
  }) => {
    const [href, setHref] = useState<string | null>(null);
    const [loadingHref, setLoadingHref] = useState<boolean>(false);

    useEffect(() => {
      let active = true;
      (async () => {
        setLoadingHref(true);
        let found: string | null = null;
        try {
          // 1) Tenta rota autenticada (funciona mesmo sem SERVICE ROLE, desde que usuário esteja logado)
          const resAuth = await fetch(`/api/upload/signed-url?path=${encodeURIComponent(storagePath)}&format=json`);
          if (resAuth.ok) {
            const json = await resAuth.json();
            found = json?.signedUrl || null;
          }
        } catch {}
        if (!found) {
          try {
            // 2) Fallback: rota pública usando SERVICE ROLE
            const resPublic = await fetch(`/api/public/upload/signed-url?path=${encodeURIComponent(storagePath)}&format=json`);
            if (resPublic.ok) {
              const json = await resPublic.json();
              found = json?.signedUrl || null;
            }
          } catch {}
        }
        if (active) {
          if (found) setHref(found);
          setLoadingHref(false);
        }
      })();
      return () => { active = false; };
    }, [storagePath]);

    // 3) Último recurso: redireciono para as rotas (uma delas deve resolver no servidor)
    const fallbackPublic = `/api/public/upload/signed-url?path=${encodeURIComponent(storagePath)}`;
    const fallbackAuth = `/api/upload/signed-url?path=${encodeURIComponent(storagePath)}`;
    const linkHref = href || fallbackAuth || fallbackPublic;
    return (
      <a
        href={linkHref}
        target="_blank"
        rel="noopener noreferrer"
        className={`${className ?? ''} cursor-pointer ${loadingHref ? 'opacity-80' : ''}`}
        title={title}
        role="link"
        tabIndex={0}
      >
        <Icon className="h-4 w-4" />
        <span className="text-sm truncate max-w-[180px]">{label}</span>
      </a>
    );
  };

  // Busca a primeira string que pareça uma URL de arquivo (registros antigos sem metadados)
  const findFirstFileUrlString = (data: Record<string, any>): string | null => {
    const isUrl = (s: any) => typeof s === 'string' && /^https?:\/\//.test(s);
    for (const key of Object.keys(data || {})) {
      const val = data[key];
      if (isUrl(val)) return String(val);
      if (Array.isArray(val)) {
        const first = val.find((v) => isUrl(v));
        if (first) return String(first);
      }
    }
    return null;
  };

  // Detecta nome do aluno considerando variações de chave
  const findStudentName = (data: Record<string, any>): string => {
    const candidatesExact = ['nome_completo', 'nome', 'name', 'aluno', 'student_name'];
    for (const k of candidatesExact) {
      if (data?.[k]) return String(data[k]);
    }
    // Fallback: busca por chaves que contenham "nome" ou "aluno"
    for (const key of Object.keys(data || {})) {
      const lk = key.toLowerCase();
      if ((lk.includes('nome') || lk.includes('aluno') || lk.includes('name')) && typeof data[key] === 'string' && data[key].trim()) {
        return String(data[key]).trim();
      }
    }
    return '';
  };

  // Detecta whatsapp/telefone considerando variações
  const findWhatsapp = (data: Record<string, any>): string => {
    const candidatesExact = ['whatsapp', 'telefone', 'phone', 'celular', 'telefone_whatsapp'];
    for (const k of candidatesExact) {
      if (data?.[k]) return String(data[k]);
    }
    // Fallback: busca por chaves relacionadas
    for (const key of Object.keys(data || {})) {
      const lk = key.toLowerCase();
      if ((lk.includes('whats') || lk.includes('zap') || lk.includes('tel') || lk.includes('cel')) && typeof data[key] === 'string' && data[key].trim()) {
        return String(data[key]).trim();
      }
    }
    return '';
  };

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [role, setRole] = useState<'superadmin' | 'admin' | 'user' | ''>('');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');

  // Carregar dados do usuário e polos (apenas para superadmin)
  useEffect(() => {
    const loadUserAndTenants = async () => {
      try {
        const res = await fetch('/api/users/me');
        const data = await res.json();
        const userRole = data?.user?.role ?? '';
        setRole(userRole);
        if (userRole === 'superadmin') {
          const tRes = await fetch('/api/tenants');
          const tData = await tRes.json();
          if (tRes.ok) setTenants(tData?.tenants || []);
        }
      } catch (err) {
        console.warn('Não foi possível carregar usuário/tenants', err);
      }
    };
    loadUserAndTenants();
  }, []);

  useEffect(() => {
    fetchSubmissions();
  }, [searchTerm, paymentStatusFilter, selectedTenantId]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (paymentStatusFilter) params.append('payment_status', paymentStatusFilter);
      if (selectedTenantId) params.append('tenant_id', selectedTenantId);
      // Evitar retorno em cache e garantir atualização pós-exclusão
      params.append('_ts', String(Date.now()));

      const response = await fetch(`/api/submissions?${params.toString()}` , {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      const data = await response.json();

      if (response.ok) {
        setSubmissions(data.submissions || []);
        setTotal(data.total || 0);
      } else {
        toast.error(data.error || 'Erro ao carregar submissões');
      }
    } catch (error) {
      console.error('Error fetching submissions:', error);
      toast.error('Erro ao carregar submissões');
    } finally {
      setLoading(false);
    }
  };

  const handleViewSubmission = (submission: Submission) => {
    setSelectedSubmission(submission);
    setViewDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingSubmission) return;

    setSubmitting(true);

    try {
      const response = await fetch(`/api/submissions/${deletingSubmission.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Submissão deletada com sucesso!');
        // Remover da lista local imediatamente (UX mais responsiva)
        const deletedId = deletingSubmission.id;
        setSubmissions((prev) => prev.filter((s) => s.id !== deletedId));
        setTotal((prev) => Math.max(prev - 1, 0));
        setDeleteDialogOpen(false);
        setDeletingSubmission(null);
        // Revalidar lista no servidor para consistência
        await fetchSubmissions();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Erro ao deletar submissão');
      }
    } catch (error) {
      console.error('Error deleting submission:', error);
      toast.error('Erro ao deletar submissão');
    } finally {
      setSubmitting(false);
    }
  };

  const exportToXLS = () => {
    if (submissions.length === 0) {
      toast.error('Nenhuma submissão para exportar');
      return;
    }

    // Coletar todos os campos únicos
    const allFields = new Set<string>();
    submissions.forEach((sub) => {
      Object.keys(sub.data).forEach((key) => allFields.add(key));
    });

    // Cabeçalhos da planilha (sem coluna de ID)
    const headers = [
      'Polo',
      'Formulário',
      'Nome Completo',
      'Whatsapp',
      ...Array.from(allFields).map((f) => formatDisplayLabel(f)),
      'Status Pagamento',
      'Valor',
      'Data Submissão',
    ];

    const escapeHtml = (str: any) => String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const rowsHtml = submissions.map((sub) => {
      const nomeCompleto = findStudentName(sub.data);
      const whatsapp = findWhatsapp(sub.data);
      const cells = [
        sub.tenants.name,
        sub.form_definitions.name,
        nomeCompleto,
        whatsapp ? formatDisplayValueByKey('whatsapp', whatsapp) : '',
        ...Array.from(allFields).map((field) => {
          const value = sub.data[field];
          return formatDisplayValueByKey(field, value ?? '');
        }),
        getPaymentStatusLabel(sub.payment_status),
        sub.payment_amount != null ? sub.payment_amount : '',
        formatDate(sub.created_at),
      ];
      return `<tr>${cells.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`;
    }).join('');

    const tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8" />
        </head>
        <body>
          <table border="1">
            <thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </body>
      </html>`;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `submissions_${new Date().toISOString().split('T')[0]}.xls`;
    link.click();

    toast.success('XLS exportado com sucesso!');
  };

  const getPaymentStatusColor = (status: string) => {
    const colors: Record<string, 'default' | 'success' | 'destructive' | 'secondary'> = {
      PENDENTE: 'destructive',
      PAGO: 'success',
      CANCELADO: 'secondary',
      NAO_APLICAVEL: 'default',
    };
    return colors[status] || 'default';
  };

  const getPaymentStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PENDENTE: 'Pendente',
      PAGO: 'Pago',
      CANCELADO: 'Cancelado',
      NAO_APLICAVEL: 'N/A',
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Submissões</h1>
          <p className="text-muted-foreground">Gerencie as inscrições e submissões de formulários</p>
        </div>
        <Button
          onClick={exportToXLS}
          variant="outline"
          disabled={submissions.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar XLS
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status Pagamento</Label>
              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md"
              >
                <option value="">Todos</option>
                <option value="PENDENTE">Pendente</option>
                <option value="PAGO">Pago</option>
                <option value="CANCELADO">Cancelado</option>
                <option value="NAO_APLICAVEL">N/A</option>
              </select>
            </div>

            {role === 'superadmin' && (
              <div className="space-y-2">
                <Label>Polo</Label>
                <select
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-md"
                >
                  <option value="">Todos</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Coluna Documento</Label>
              <div className="flex items-center gap-2 text-sm">
                <input
                  id="doc-column"
                  type="checkbox"
                  checked={showDocumentColumn}
                  onChange={(e) => setShowDocumentColumn(e.target.checked)}
                />
                <label htmlFor="doc-column" className="cursor-pointer">Mostrar coluna “Documento”</label>
              </div>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setPaymentStatusFilter('');
                  setSelectedTenantId('');
                }}
              >
                Limpar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Submissões</CardTitle>
          <CardDescription>
            {total} {total === 1 ? 'submissão encontrada' : 'submissões encontradas'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nenhuma submissão encontrada.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Polo</TableHead>
                    <TableHead>Aluno</TableHead>
                    <TableHead>Whatsapp</TableHead>
                    {showDocumentColumn && <TableHead>Documento</TableHead>}
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((submission) => {
                    // Exibir somente o nome do aluno (coluna "Aluno")
                    const studentName = findStudentName(submission.data);
                    const whatsappRaw = findWhatsapp(submission.data);
                    const fileMeta = findFirstFileMeta(submission.data);
                    const fileUrlString = findFirstFileUrlString(submission.data);

                    return (
                      <TableRow key={submission.id}>
                        <TableCell>
                          <Badge variant="outline">{submission.tenants.name}</Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{studentName || '-'}</TableCell>
                        <TableCell className="max-w-xs truncate">{whatsappRaw ? formatPhone(whatsappRaw) : '-'}</TableCell>
                        {showDocumentColumn && (
                          <TableCell>
                            {fileMeta ? (() => {
                              const t = detectFileType(fileMeta);
                              const Icon = pickIcon(t);
                              const label = fileMeta.name || 'Arquivo';
                              const sizeLabel = formatBytes(fileMeta.size);

                              // Caso exista storagePath, resolvemos Signed URL com domínio do Supabase via DocumentAnchor
                              if (fileMeta.storagePath) {
                                return (
                                  <div className="flex items-center gap-2">
                                    <DocumentAnchor
                                      storagePath={fileMeta.storagePath}
                                      Icon={Icon}
                                      label={label}
                                      title={`${label} • ${sizeLabel}`}
                                      className="inline-flex items-center gap-2 text-brand-primary underline"
                                    />
                                  </div>
                                );
                              }

                              // Se não houver storagePath mas houver URL, exibe link direto
                              if (fileMeta.url) {
                                // Tenta extrair storagePath de URL pública antiga do Supabase para também usar Signed URL
                                const basePath = '/storage/v1/object/public/form-submissions/';
                                const idx = fileMeta.url.indexOf(basePath);
                                if (idx >= 0) {
                                  const storageRel = fileMeta.url.substring(idx + basePath.length);
                                  if (storageRel) {
                                    return (
                                      <div className="flex items-center gap-2">
                                        <DocumentAnchor
                                          storagePath={storageRel}
                                          Icon={Icon}
                                          label={label}
                                          title={`${label} • ${sizeLabel}`}
                                          className="inline-flex items-center gap-2 text-brand-primary underline"
                                        />
                                      </div>
                                    );
                                  }
                                }

                                return (
                                  <div className="flex items-center gap-2">
                                    <a
                                      href={fileMeta.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-2 text-brand-primary underline"
                                      title={`${label} • ${sizeLabel}`}
                                    >
                                      <Icon className="h-4 w-4" />
                                      <span className="text-sm truncate max-w-[180px]">{label}</span>
                                    </a>
                                  </div>
                                );
                              }

                              // Sem URL
                              return (
                                <div className="flex items-center gap-2">
                                  <Icon className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm truncate max-w-[180px]" title={`${label} • ${sizeLabel}`}>{label}</span>
                                </div>
                              );
                            })() : fileUrlString ? (() => {
                              const cleanUrl = fileUrlString.split('#')[0];
                              const fileNameFromUrl = (cleanUrl.split('?')[0].split('/').pop() || 'Documento');

                              // Se URL pública antiga do Supabase, extrai storagePath e usa DocumentAnchor
                              const basePath = '/storage/v1/object/public/form-submissions/';
                              const idx = cleanUrl.indexOf(basePath);
                              if (idx >= 0) {
                                const storageRel = cleanUrl.substring(idx + basePath.length);
                                if (storageRel) {
                                  const pseudoMeta: FileMeta = { name: fileNameFromUrl };
                                  const t = detectFileType(pseudoMeta);
                                  const Icon = pickIcon(t);
                                  return (
                                    <DocumentAnchor
                                      storagePath={storageRel}
                                      Icon={Icon}
                                      label={fileNameFromUrl}
                                      title={fileNameFromUrl}
                                      className="inline-flex items-center gap-2 text-brand-primary underline"
                                    />
                                  );
                                }
                              }

                              // Caso contrário, mantém link direto
                              const pseudoMeta: FileMeta = { name: fileNameFromUrl };
                              const t = detectFileType(pseudoMeta);
                              const Icon = pickIcon(t);
                              return (
                                <a
                                  href={cleanUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 text-brand-primary underline"
                                  title={fileNameFromUrl}
                                >
                                  <Icon className="h-4 w-4" />
                                  <span className="text-sm truncate max-w-[180px]">{fileNameFromUrl}</span>
                                </a>
                              );
                            })() : (
                              <Badge variant="destructive" className="text-xs">Arquivo ausente — reenvio necessário</Badge>
                            )}
                          </TableCell>
                        )}
                        <TableCell>
                          <Badge variant={getPaymentStatusColor(submission.payment_status)}>
                            {getPaymentStatusLabel(submission.payment_status)}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(submission.created_at)}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleViewSubmission(submission)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeletingSubmission(submission);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Ver Detalhes */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle>Detalhes da Submissão</DialogTitle>
            <DialogDescription>
            {selectedSubmission?.form_definitions.name} • {selectedSubmission?.tenants.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {selectedSubmission && (
              <>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-muted-foreground">Status Pagamento</Label>
                    <div className="mt-1">
                      <Badge variant={getPaymentStatusColor(selectedSubmission.payment_status)}>
                        {getPaymentStatusLabel(selectedSubmission.payment_status)}
                      </Badge>
                    </div>
                  </div>
                  {selectedSubmission.payment_amount && (
                    <div>
                      <Label className="text-muted-foreground">Valor</Label>
                      <p className="mt-1 font-semibold">
                        R$ {selectedSubmission.payment_amount.toFixed(2)}
                      </p>
                    </div>
                  )}
                  <div>
                    <Label className="text-muted-foreground">Data Submissão</Label>
                    <p className="mt-1">{formatDate(selectedSubmission.created_at)}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Dados do Formulário</h3>
                  {Object.entries(selectedSubmission.data).map(([key, value]) => {
                    const isString = typeof value === 'string';
                    const valStr = isString ? value : '';
                    const isUrlString = isString && /^https?:\/\//.test(valStr);
                    const cleanUrl = isString ? valStr.split('#')[0] : '';
                    const fileNameFromUrl = isString ? (cleanUrl.split('?')[0].split('/').pop() || '') : '';

                    // Caso 1: metadados de arquivo (objeto)
                    if (isFileMeta(value)) {
                      const meta = value;
                      const typeLabel = detectFileType(meta);
                      const Icon = pickIcon(typeLabel);
                      const sizeLabel = formatBytes(meta.size);
                      const label = meta.name || 'Documento';
                      return (
                        <div key={key} className="grid grid-cols-2 md:grid-cols-3 gap-3 py-1">
                          <Label className="text-muted-foreground pr-2">
                            {formatDisplayLabel(key)}:
                          </Label>
                          <div className="col-span-1 md:col-span-2 font-medium break-words">
                            <div className="flex items-center gap-2">
                              {meta.storagePath ? (
                                <DocumentAnchor
                                  storagePath={meta.storagePath}
                                  Icon={Icon}
                                  label={label}
                                  title={`${label} • ${typeLabel.toUpperCase()} • ${sizeLabel}`}
                                  className="inline-flex items-center"
                                />
                              ) : meta.url ? (
                                (() => {
                                  const basePath = '/storage/v1/object/public/form-submissions/';
                                  const idx = meta.url.indexOf(basePath);
                                  if (idx >= 0) {
                                    const storageRel = meta.url.substring(idx + basePath.length);
                                    if (storageRel) {
                                      return (
                                        <DocumentAnchor
                                          storagePath={storageRel}
                                          Icon={Icon}
                                          label={label}
                                          title={`${label} • ${typeLabel.toUpperCase()} • ${sizeLabel}`}
                                          className="inline-flex items-center"
                                        />
                                      );
                                    }
                                  }
                                  return (
                                    <a href={meta.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center">
                                      <Icon className="h-4 w-4" />
                                    </a>
                                  );
                                })()
                              ) : (
                                <Icon className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="truncate" title={`${label} • ${typeLabel.toUpperCase()} • ${sizeLabel}`}>{label}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Tipo: {typeLabel.toUpperCase()} • Tamanho: {sizeLabel}</p>
                          </div>
                        </div>
                      );
                    }

                    // Caso 2: string com URL de arquivo (sem metadados estruturados)
                    if (isUrlString) {
                      const basePath = '/storage/v1/object/public/form-submissions/';
                      const idx = valStr.indexOf(basePath);
                      const storageRel = idx >= 0 ? valStr.substring(idx + basePath.length) : '';
                      return (
                        <div key={key} className="grid grid-cols-2 md:grid-cols-3 gap-3 py-1">
                          <Label className="text-muted-foreground pr-2">
                            {formatDisplayLabel(key)}:
                          </Label>
                          <div className="col-span-1 md:col-span-2 font-medium break-words">
                            {storageRel ? (
                              <span className="text-brand-primary underline inline-flex items-center gap-2">
                                <DocumentAnchor
                                  storagePath={storageRel}
                                  Icon={LinkIcon}
                                  label={fileNameFromUrl || 'Abrir documento'}
                                  title={fileNameFromUrl || 'Abrir documento'}
                                  className="inline-flex items-center gap-2"
                                />
                              </span>
                            ) : (
                              <a
                                href={valStr}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-brand-primary underline inline-flex items-center gap-2"
                              >
                                <LinkIcon className="h-4 w-4" />
                                {fileNameFromUrl || 'Abrir documento'}
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // Caso 3: valor comum
                    return (
                      <div key={key} className="grid grid-cols-2 md:grid-cols-3 gap-3 py-1">
                        <Label className="text-muted-foreground pr-2">
                          {formatDisplayLabel(key)}:
                        </Label>
                        <div className="col-span-1 md:col-span-2 font-medium break-words">
                          <p>{formatDisplayValueByKey(key, value)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Deletar */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja deletar esta submissão? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Deletar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
