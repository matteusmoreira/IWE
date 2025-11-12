'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface Metrics {
  totalSubmissions: number;
  totalRevenue: number;
  conversionRate: number;
  activeForms: number;
  submissionsByDay: Array<{ date: string; count: number }>;
  revenueByDay: Array<{ date: string; amount: number }>;
  formPerformance: Array<{
    formId: string;
    formTitle: string;
    submissions: number;
    conversions: number;
    conversionRate: number;
  }>;
  paymentStats: {
    approved: number;
    pending: number;
    failed: number;
  };
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  // Filtro por mês/ano
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1)); // 1-12
  const [year, setYear] = useState(String(now.getFullYear()));
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenant, setSelectedTenant] = useState('');

  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [month, year, selectedTenant]);

  const fetchTenants = async () => {
    try {
      const response = await fetch('/api/tenants');
      const data = await response.json();
      if (response.ok) {
        setTenants(data.tenants || []);
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
    }
  };

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ month, year });
      if (selectedTenant) {
        params.append('tenant_id', selectedTenant);
      }

      const response = await fetch(`/api/metrics?${params}`);
      const data = await response.json();

      if (response.ok) {
        setMetrics(data);
      } else {
        toast.error(data.error || 'Erro ao carregar métricas');
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
      toast.error('Erro ao carregar métricas');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  const paymentChartData = [
    { label: 'Aprovados', value: metrics?.paymentStats.approved || 0, color: '#10B981' },
    { label: 'Pendentes', value: metrics?.paymentStats.pending || 0, color: '#F59E0B' },
    { label: 'Falhou', value: metrics?.paymentStats.failed || 0, color: '#EF4444' },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral e métricas do sistema</p>
        </div>
        <div className="w-full md:w-auto flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMetrics}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Atualizar</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium mb-2 block">Mês</label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="1">Janeiro</option>
                <option value="2">Fevereiro</option>
                <option value="3">Março</option>
                <option value="4">Abril</option>
                <option value="5">Maio</option>
                <option value="6">Junho</option>
                <option value="7">Julho</option>
                <option value="8">Agosto</option>
                <option value="9">Setembro</option>
                <option value="10">Outubro</option>
                <option value="11">Novembro</option>
                <option value="12">Dezembro</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium mb-2 block">Ano</label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - i)).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium mb-2 block">Polo</label>
              <select
                value={selectedTenant}
                onChange={(e) => setSelectedTenant(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Todos os Polos</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards - Apenas Total de Inscrições */}
      <div className="grid gap-4 md:grid-cols-1">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Inscrições</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalSubmissions || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Cadastros realizados no mês selecionado
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Demais métricas e gráficos ocultados conforme solicitação */}
    </div>
  );
}
