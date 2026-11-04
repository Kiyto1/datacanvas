import { BarChart, LineChart, ScatterChart } from 'echarts/charts';
import { AriaComponent, GridComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'react';

// Tree-shaken registration keeps the bundle small.
echarts.use([BarChart, LineChart, ScatterChart, GridComponent, TooltipComponent, AriaComponent, CanvasRenderer]);

type Option = Parameters<echarts.ECharts['setOption']>[0];

interface Props {
  option: Option;
  ariaLabel: string;
  /** Called with the clicked category label (bars). */
  onSelect?: (label: string) => void;
}

export function EChart({ option, ariaLabel, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const instance = echarts.init(el, undefined, { renderer: 'canvas' });
    chart.current = instance;
    instance.on('click', (params) => {
      const label = (params as { name?: unknown }).name;
      if (typeof label === 'string') onSelectRef.current?.(label);
    });
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(el);
    return () => {
      observer.disconnect();
      instance.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    chart.current?.setOption(option, { notMerge: true });
  }, [option]);

  return <div ref={host} className="dc-chart" role="img" aria-label={ariaLabel} />;
}
