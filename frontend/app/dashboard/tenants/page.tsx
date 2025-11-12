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
import { Plus, Edit2, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate, slugify } from '@/lib/utils';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: boolean;
  created_at: string;
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    status: true,
  });

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tenants');
      const data = await response.json();

      if (response.ok) {
        setTenants(data.tenants || []);
        setRole(data.role || null);
      } else {
        toast.error(data.error || 'Erro ao carregar polos');
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
      toast.error('Erro ao carregar polos');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (tenant?: Tenant) => {
    // RBAC: apenas superadmin pode criar/editar polos
    if (role !== 'superadmin') {
      toast.error('Apenas superadmin pode criar/editar polos');
      return;
    }
    if (tenant) {
      setEditingTenant(tenant);
      setFormData({
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
      });
    } else {
      setEditingTenant(null);
      setFormData({
        name: '',
        slug: '',
        status: true,
      });
    }
    setDialogOpen(true);
  };

  const handleNameChange = (name: string) => {
    setFormData({
      ...formData,
      name,
      slug: slugify(name),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // RBAC: apenas superadmin pode criar/editar polos
    if (role !== 'superadmin') {
      toast.error('Apenas superadmin pode criar/editar polos');
      return;
    }
    setSubmitting(true);

    try {
      const url = editingTenant ? `/api/tenants/${editingTenant.id}` : '/api/tenants';
      const method = editingTenant ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(editingTenant ? 'Polo atualizado com sucesso!' : 'Polo criado com sucesso!');
        setDialogOpen(false);
        fetchTenants();
      } else {
        toast.error(data.error || 'Erro ao salvar polo');
      }
    } catch (error) {
      console.error('Error saving tenant:', error);
      toast.error('Erro ao salvar polo');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTenant) return;

    // RBAC: apenas superadmin pode excluir polos
    if (role !== 'superadmin') {
      toast.error('Apenas superadmin pode excluir polos');
      return;
    }
    setSubmitting(true);

    try {
      const response = await fetch(`/api/tenants/${deletingTenant.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Polo deletado com sucesso!');
        setDeleteDialogOpen(false);
        setDeletingTenant(null);
        fetchTenants();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Erro ao deletar polo');
      }
    } catch (error) {
      console.error('Error deleting tenant:', error);
      toast.error('Erro ao deletar polo');
    } finally {
      setSubmitting(false);
    }
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
          <h1 className="text-3xl font-bold">Polos</h1>
          <p className="text-muted-foreground">Gerencie os polos (tenants) do sistema</p>
        </div>
        {role === 'superadmin' && (
          <div className="w-full md:w-auto flex justify-center">
            <Button onClick={() => handleOpenDialog()} className="bg-brand-primary hover:bg-brand-primary/90">
              <Plus className="mr-2 h-4 w-4" />
              Novo Polo
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Polos</CardTitle>
          <CardDescription>
            {tenants.length} {tenants.length === 1 ? 'polo cadastrado' : 'polos cadastrados'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tenants.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nenhum polo cadastrado ainda.</p>
              {role === 'superadmin' && (
                <Button onClick={() => handleOpenDialog()} className="mt-4" variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Primeiro Polo
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  {role === 'superadmin' && (
                    <TableHead className="text-right">Ações</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">{tenant.slug}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={tenant.status ? 'success' : 'destructive'}>
                        {tenant.status ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(tenant.created_at)}</TableCell>
                    {role === 'superadmin' && (
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(tenant)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeletingTenant(tenant);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog Criar/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTenant ? 'Editar Polo' : 'Novo Polo'}</DialogTitle>
            <DialogDescription>
              {editingTenant
                ? 'Atualize as informações do polo abaixo.'
                : 'Preencha as informações do novo polo.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Polo *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ex: Polo Minas Gerais"
                  required
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug (URL amigável) *</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="Ex: polo-mg"
                  required
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground">
                  Usado na URL dos formulários: /f/{formData.slug || 'slug'}/formulario
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="status"
                  checked={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.checked })}
                  disabled={submitting}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="status" className="cursor-pointer">Polo ativo</Label>
              </div>
            </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-brand-primary hover:bg-brand-primary/90 w-full sm:w-auto"
              disabled={submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingTenant ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Deletar */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja deletar o polo <strong>{deletingTenant?.name}</strong>?
              <br />
              <span className="text-destructive">Esta ação não pode ser desfeita!</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={submitting}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              type="button"
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
