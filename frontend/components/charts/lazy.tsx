'use client';

// Wrappers de importação dinâmica para gráficos pesados
// Evitam SSR e reduzem hidratação quando gráficos não são necessários imediatamente
import dynamic from 'next/dynamic';

export const LazyDonutChart = dynamic(
  () => import('./donut-chart').then((m) => m.DonutChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
        Carregando gráfico...
      </div>
    ),
  }
);

export const LazyBarChart = dynamic(
  () => import('./bar-chart').then((m) => m.BarChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
        Carregando gráfico...
      </div>
    ),
  }
);