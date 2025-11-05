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
import { Eye, Trash2, Loader2, Search, Download, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';

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
    title: string;
  };
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

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');

  useEffect(() => {
    fetchSubmissions();
  }, [searchTerm, paymentStatusFilter]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (paymentStatusFilter) params.append('payment_status', paymentStatusFilter);

      const response = await fetch(`/api/submissions?${params.toString()}`);
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
        setDeleteDialogOpen(false);
        setDeletingSubmission(null);
        fetchSubmissions();
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

  const exportToCSV = () => {
    if (submissions.length === 0) {
      toast.error('Nenhuma submissão para exportar');
      return;
    }

    // Coletar todos os campos únicos
    const allFields = new Set<string>();
    submissions.forEach((sub) => {
      Object.keys(sub.data).forEach((key) => allFields.add(key));
    });

    // Cabeçalhos
    const headers = [
      'ID',
      'Polo',
      'Formulário',
      ...Array.from(allFields),
      'Status Pagamento',
      'Valor',
      'Data Submissão',
    ];

    // Linhas
    const rows = submissions.map((sub) => {
      const row = [
        sub.id,
        sub.tenants.name,
        sub.form_definitions.title,
        ...Array.from(allFields).map((field) => {
          const value = sub.data[field];
          if (Array.isArray(value)) return value.join(', ');
          return value || '';
        }),
        sub.payment_status,
        sub.payment_amount || '',
        formatDate(sub.created_at),
      ];
      return row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',');
    });

    // Criar CSV
    const csv = [headers.map((h) => `"${h}"`).join(','), ...rows].join('\\n');

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `submissions_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toast.success('CSV exportado com sucesso!');
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
          onClick={exportToCSV}
          variant="outline"
          disabled={submissions.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
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

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setPaymentStatusFilter('');
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
                    <TableHead>Formulário</TableHead>
                    <TableHead>Dados</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((submission) => {
                    // Extrair alguns campos principais para exibição
                    const mainFields = ['nome', 'name', 'email', 'telefone', 'phone'];
                    const displayData = mainFields
                      .map((field) => submission.data[field])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join(' • ') || 'Ver detalhes';

                    return (
                      <TableRow key={submission.id}>
                        <TableCell>
                          <Badge variant="outline">{submission.tenants.name}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {submission.form_definitions.title}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{displayData}</TableCell>
                        <TableCell>
                          <Badge variant={getPaymentStatusColor(submission.payment_status)}>
                            {getPaymentStatusLabel(submission.payment_status)}
                          </Badge>
                          {submission.payment_amount && (
                            <span className="ml-2 text-sm text-muted-foreground">
                              R$ {submission.payment_amount.toFixed(2)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{formatDate(submission.created_at)}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="ghost"
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Submissão</DialogTitle>
            <DialogDescription>
              {selectedSubmission?.form_definitions.title} • {selectedSubmission?.tenants.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedSubmission && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Status Pagamento</Label>
                    <p className="mt-1">
                      <Badge variant={getPaymentStatusColor(selectedSubmission.payment_status)}>
                        {getPaymentStatusLabel(selectedSubmission.payment_status)}
                      </Badge>
                    </p>
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

                <hr />

                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">Dados do Formulário</h3>
                  {Object.entries(selectedSubmission.data).map(([key, value]) => (
                    <div key={key} className="grid grid-cols-3 gap-2">
                      <Label className="text-muted-foreground capitalize">
                        {key.replace(/_/g, ' ')}:
                      </Label>
                      <p className="col-span-2 font-medium">
                        {Array.isArray(value) ? value.join(', ') : String(value)}
                      </p>
                    </div>
                  ))}
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
