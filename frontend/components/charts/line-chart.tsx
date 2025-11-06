'use client';

import React from 'react';

interface DataPoint {
  date: string;
  count: number;
}

interface LineChartProps {
  data: DataPoint[];
  color?: string;
  height?: number;
}

export function LineChart({ data, color = '#3B82F6', height = 200 }: LineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Sem dados para exibir
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.count), 1);
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - (d.count / maxValue) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="w-full" style={{ height: `${height}px` }}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* Grid lines */}
        <line x1="0" y1="25" x2="100" y2="25" stroke="#e5e7eb" strokeWidth="0.2" />
        <line x1="0" y1="50" x2="100" y2="50" stroke="#e5e7eb" strokeWidth="0.2" />
        <line x1="0" y1="75" x2="100" y2="75" stroke="#e5e7eb" strokeWidth="0.2" />
        
        {/* Area under the line */}
        <polygon
          points={`0,100 ${points} 100,100`}
          fill={color}
          fillOpacity="0.1"
        />
        
        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        
        {/* Dots */}
        {data.map((d, i) => {
          const x = (i / (data.length - 1)) * 100;
          const y = 100 - (d.count / maxValue) * 100;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="1.5"
              fill={color}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
      
      {/* Labels */}
      <div className="flex justify-between mt-2 text-xs text-muted-foreground">
        <span>{data[0]?.date ? new Date(data[0].date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : ''}</span>
        <span>{data[Math.floor(data.length / 2)]?.date ? new Date(data[Math.floor(data.length / 2)].date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : ''}</span>
        <span>{data[data.length - 1]?.date ? new Date(data[data.length - 1].date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : ''}</span>
      </div>
    </div>
  );
}
