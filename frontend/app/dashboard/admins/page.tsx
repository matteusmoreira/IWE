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
import { Select } from '@/components/ui/select';
import { Plus, Edit2, Trash2, Loader2, Shield, User } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface Admin {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'superadmin' | 'admin';
  is_active: boolean;
  created_at: string;
  admin_tenants: Array<{
    tenant_id: string;
    tenants: Tenant;
  }>;
}

export default function AdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [deletingAdmin, setDeletingAdmin] = useState<Admin | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'admin' as 'admin' | 'superadmin',
    is_active: true,
    tenant_ids: [] as string[],
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Buscar admins e tenants em paralelo
      const [adminsResponse, tenantsResponse] = await Promise.all([
        fetch('/api/admins'),
        fetch('/api/tenants'),
      ]);

      const adminsData = await adminsResponse.json();
      const tenantsData = await tenantsResponse.json();

      if (adminsResponse.ok) {
        setAdmins(adminsData.admins || []);
      } else {
        toast.error(adminsData.error || 'Erro ao carregar admins');
      }

      if (tenantsResponse.ok) {
        setTenants(tenantsData.tenants || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (admin?: Admin) => {
    if (admin) {
      setEditingAdmin(admin);
      const linkedTenantIds = admin.admin_tenants?.map(at => at.tenant_id) || [];
      setFormData({
        name: admin.name,
        email: admin.email,
        phone: admin.phone || '',
        password: '', // Não preencher senha ao editar
        role: admin.role,
        is_active: admin.is_active,
        tenant_ids: linkedTenantIds,
      });
    } else {
      setEditingAdmin(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        password: '',
        role: 'admin',
        is_active: true,
        tenant_ids: [],
      });
    }
    setDialogOpen(true);
  };

  const handleTenantToggle = (tenantId: string) => {
    setFormData(prev => ({
      ...prev,
      tenant_ids: prev.tenant_ids.includes(tenantId)
        ? prev.tenant_ids.filter(id => id !== tenantId)
        : [...prev.tenant_ids, tenantId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Validar senha apenas ao criar novo admin
      if (!editingAdmin && formData.password.length < 6) {
        toast.error('A senha deve ter no mínimo 6 caracteres');
        setSubmitting(false);
        return;
      }

      const url = editingAdmin ? `/api/admins/${editingAdmin.id}` : '/api/admins';
      const method = editingAdmin ? 'PATCH' : 'POST';

      const payload = editingAdmin
        ? {
            name: formData.name,
            phone: formData.phone || null,
            role: formData.role,
            is_active: formData.is_active,
            tenant_ids: formData.tenant_ids,
          }
        : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(editingAdmin ? 'Admin atualizado com sucesso!' : 'Admin criado com sucesso!');
        setDialogOpen(false);
        fetchData();
      } else {
        toast.error(data.error || 'Erro ao salvar admin');
      }
    } catch (error) {
      console.error('Error saving admin:', error);
      toast.error('Erro ao salvar admin');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingAdmin) return;

    setSubmitting(true);

    try {
      const response = await fetch(`/api/admins/${deletingAdmin.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Admin deletado com sucesso!');
        setDeleteDialogOpen(false);
        setDeletingAdmin(null);
        fetchData();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Erro ao deletar admin');
      }
    } catch (error) {
      console.error('Error deleting admin:', error);
      toast.error('Erro ao deletar admin');
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
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Administradores</h1>
          <p className="text-muted-foreground">Gerencie os usuários administradores do sistema</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="bg-brand-primary hover:bg-brand-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          Novo Admin
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Administradores</CardTitle>
          <CardDescription>
            {admins.length} {admins.length === 1 ? 'administrador cadastrado' : 'administradores cadastrados'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {admins.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nenhum administrador cadastrado ainda.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Polos Vinculados</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">{admin.name}</TableCell>
                    <TableCell>{admin.email}</TableCell>
                    <TableCell>
                      <Badge variant={admin.role === 'superadmin' ? 'default' : 'secondary'}>
                        {admin.role === 'superadmin' ? (
                          <><Shield className="w-3 h-3 mr-1" /> Superadmin</>
                        ) : (
                          <><User className="w-3 h-3 mr-1" /> Admin</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {admin.admin_tenants && admin.admin_tenants.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {admin.admin_tenants.map((at) => (
                            <Badge key={at.tenant_id} variant="outline" className="text-xs">
                              {at.tenants.name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Nenhum</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={admin.is_active ? 'success' : 'destructive'}>
                        {admin.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(admin.created_at)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(admin)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDeletingAdmin(admin);
                          setDeleteDialogOpen(true);
                        }}
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

      {/* Dialog Criar/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAdmin ? 'Editar Admin' : 'Novo Admin'}</DialogTitle>
            <DialogDescription>
              {editingAdmin
                ? 'Atualize as informações do administrador.'
                : 'Preencha as informações do novo administrador.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: João Silva"
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="joao@email.com"
                    required
                    disabled={submitting || !!editingAdmin}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(11) 99999-9999"
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Função *</Label>
                  <Select
                    id="role"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    disabled={submitting}
                  >
                    <option value="admin">Admin</option>
                    <option value="superadmin">Superadmin</option>
                  </Select>
                </div>
              </div>

              {!editingAdmin && (
                <div className="space-y-2">
                  <Label htmlFor="password">Senha *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                    required={!editingAdmin}
                    disabled={submitting}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Vincular a Polos</Label>
                <div className="border rounded-md p-4 space-y-2 max-h-48 overflow-y-auto">
                  {tenants.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum polo disponível</p>
                  ) : (
                    tenants.map((tenant) => (
                      <div key={tenant.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`tenant-${tenant.id}`}
                          checked={formData.tenant_ids.includes(tenant.id)}
                          onChange={() => handleTenantToggle(tenant.id)}
                          disabled={submitting}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor={`tenant-${tenant.id}`} className="cursor-pointer flex-1">
                          {tenant.name}
                        </Label>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  disabled={submitting}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="is_active" className="cursor-pointer">Usuário ativo</Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-brand-primary hover:bg-brand-primary/90"
                disabled={submitting}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingAdmin ? 'Atualizar' : 'Criar'}
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
              Tem certeza que deseja deletar o admin <strong>{deletingAdmin?.name}</strong>?
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
            >
              Cancelar
            </Button>
            <Button
              type="button"
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
