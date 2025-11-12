'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { Plus, Edit2, Trash2, Loader2, Eye, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import { Form } from '@/lib/form-field-types';

export default function FormsPage() {
  const router = useRouter();
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingForm, setDeletingForm] = useState<Form | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchForms();
  }, []);

  const fetchForms = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/forms');
      const data = await response.json();

      if (response.ok) {
        setForms(data.forms || []);
      } else {
        toast.error(data.error || 'Erro ao carregar formulários');
      }
    } catch (error) {
      console.error('Error fetching forms:', error);
      toast.error('Erro ao carregar formulários');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingForm) return;

    setSubmitting(true);

    try {
      const response = await fetch(`/api/forms/${deletingForm.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Formulário deletado com sucesso!');
        setDeleteDialogOpen(false);
        setDeletingForm(null);
        fetchForms();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Erro ao deletar formulário');
      }
    } catch (error) {
      console.error('Error deleting form:', error);
      toast.error('Erro ao deletar formulário');
    } finally {
      setSubmitting(false);
    }
  };

  const copyPublicUrl = (form: Form) => {
    const base = window.location.origin;
    const url = form.slug ? `${base}/f/${form.slug}` : `${base}/form/${form.id}`;
    navigator.clipboard.writeText(url);
    toast.success('URL pública copiada!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-bold">Formulários</h1>
          <p className="text-muted-foreground">Crie e gerencie formulários personalizados</p>
        </div>
        <div className="w-full md:w-auto flex justify-center">
          <Button 
            onClick={() => router.push('/dashboard/forms/new')} 
            className="bg-brand-primary hover:bg-brand-primary/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo Formulário
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Formulários</CardTitle>
          <CardDescription>
            {forms.length} {forms.length === 1 ? 'formulário cadastrado' : 'formulários cadastrados'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {forms.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">Nenhum formulário cadastrado ainda.</p>
              <Button 
                onClick={() => router.push('/dashboard/forms/new')}
                className="bg-brand-primary hover:bg-brand-primary/90"
              >
                <Plus className="mr-2 h-4 w-4" />
                Criar Primeiro Formulário
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Polo</TableHead>
                  <TableHead>Campos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forms.map((form) => (
                  <TableRow key={form.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{form.name}</p>
                        {form.description && (
                          <p className="text-sm text-muted-foreground">{form.description}</p>
                        )}
                        {form.slug && (
                          <p className="text-xs text-muted-foreground mt-1">
                            <code className="bg-muted px-2 py-0.5 rounded">
                              {`${typeof window !== 'undefined' ? window.location.origin : ''}/f/${form.slug}`}
                            </code>
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{form.tenants?.name || '— sem polo —'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {form.form_fields?.length || 0} campos
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={form.is_active ? 'success' : 'destructive'}>
                        {form.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(form.created_at)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyPublicUrl(form)}
                        title="Copiar URL pública"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push(`/dashboard/forms/${form.id}/edit`)}
                        title="Editar"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDeletingForm(form);
                          setDeleteDialogOpen(true);
                        }}
                        title="Deletar"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog Deletar */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja deletar o formulário <strong>{deletingForm?.name}</strong>?
              {' '}Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={submitting}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={submitting}
              className="w-full sm:w-auto"
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
