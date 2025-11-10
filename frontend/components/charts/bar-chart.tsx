'use client';

import React from 'react';

interface DataPoint {
  date: string;
  amount: number;
}

interface BarChartProps {
  data: DataPoint[];
  color?: string;
  height?: number;
  formatValue?: (value: number) => string;
}

export function BarChart({ 
  data, 
  color = '#10B981', 
  height = 200,
  formatValue = (v) => v.toString()
}: BarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Sem dados para exibir
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.amount), 1);

  return (
    <div className="w-full space-y-2">
      <div className="flex items-end justify-around gap-1" style={{ height: `${height}px` }}>
        {data.map((d, i) => {
          const barHeight = (d.amount / maxValue) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col justify-end items-center group">
              <div className="relative w-full">
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                    {formatValue(d.amount)}
                  </div>
                </div>
                
                {/* Bar */}
                <div
                  className="w-full rounded-t transition-opacity duration-300 hover:opacity-80"
                  style={{
                    height: `${barHeight}%`,
                    backgroundColor: color,
                    minHeight: d.amount > 0 ? '4px' : '0px'
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Labels - show only a subset for readability */}
      <div className="flex justify-between text-xs text-muted-foreground">
        {data.length <= 7 ? (
          data.map((d, i) => (
            <span key={i} className="text-center flex-1">
              {new Date(d.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </span>
          ))
        ) : (
          <>
            <span>{new Date(data[0].date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
            <span>{new Date(data[Math.floor(data.length / 2)].date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
            <span>{new Date(data[data.length - 1].date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
          </>
        )}
      </div>
    </div>
  );
}
