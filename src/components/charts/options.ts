import { formatNumber, formatPercent } from '../../core/format';
import type { Lang } from '../../i18n';
import type { ChartResult } from '../../dashboard/types';
import { PALETTE, prefersReducedMotion, type Scheme } from './theme';

export interface OptionContext {
  scheme: Scheme;
  lang: Lang;
  /** Labels currently selected by a cross-filter on this chart's dimension. */
  selected: readonly string[];
  /** Axis titles for scatter. */
  xName?: string;
  yName?: string;
  /** Label for the grouped remainder in distributions. */
  otherLabel: string;
}

const FONT = "'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, sans-serif";

function base(ctx: OptionContext) {
  const p = PALETTE[ctx.scheme];
  return {
    p,
    common: {
      animation: !prefersReducedMotion(),
      animationDuration: 250,
      textStyle: { fontFamily: FONT, color: p.muted },
      aria: { enabled: true },
      backgroundColor: 'transparent',
    },
    tooltip: {
      confine: true,
      backgroundColor: p.surface,
      borderColor: p.grid,
      textStyle: { color: p.ink, fontFamily: FONT },
    },
  };
}

type BarLikeResult = Extract<ChartResult, { kind: 'bar' | 'distribution' }>;

/** One-series horizontal bars: thin marks, rounded data end, value labels, hairline grid. */
function horizontalBars(result: BarLikeResult, ctx: OptionContext, percentOfTotal: boolean) {
  const { p, common, tooltip } = base(ctx);
  const labels = [...result.labels];
  const values = [...result.values];
  if (result.kind === 'distribution' && result.other > 0) {
    labels.push(ctx.otherLabel);
    values.push(result.other);
  }
  const total = values.reduce((s, v) => s + v, 0);
  const filtering = ctx.selected.length > 0;
  return {
    ...common,
    grid: { left: 8, right: 72, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      ...tooltip,
      trigger: 'item' as const,
      formatter: (params: unknown) => {
        const { name, value } = params as { name: string; value: number };
        const share = percentOfTotal && total > 0 ? ` (${formatPercent(value / total, ctx.lang)})` : '';
        return `${name}<br/><b>${formatNumber(value, ctx.lang)}</b>${share}`;
      },
    },
    xAxis: {
      type: 'value' as const,
      axisLabel: { color: p.faint, formatter: (v: number) => formatNumber(v, ctx.lang, true) },
      splitLine: { lineStyle: { color: p.grid, width: 1 } },
    },
    yAxis: {
      type: 'category' as const,
      inverse: true,
      data: labels,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: p.axis } },
      axisLabel: { color: p.muted, width: 120, overflow: 'truncate' as const },
    },
    series: [
      {
        type: 'bar' as const,
        barMaxWidth: 16,
        data: values.map((value, i) => ({
          value,
          name: labels[i],
          itemStyle: {
            color: p.series[0],
            opacity: filtering && !ctx.selected.includes(labels[i] ?? '') ? 0.35 : 1,
            borderRadius: [0, 4, 4, 0],
          },
        })),
        label: {
          show: true,
          position: 'right' as const,
          color: p.ink,
          fontFamily: FONT,
          formatter: (params: unknown) => {
            const { value } = params as { value: number };
            const share = percentOfTotal && total > 0 ? ` · ${formatPercent(value / total, ctx.lang)}` : '';
            return `${formatNumber(value, ctx.lang, true)}${share}`;
          },
        },
        emphasis: { itemStyle: { opacity: 1 } },
      },
    ],
  };
}

function line(result: Extract<ChartResult, { kind: 'line' }>, ctx: OptionContext) {
  const { p, common, tooltip } = base(ctx);
  return {
    ...common,
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: {
      ...tooltip,
      trigger: 'axis' as const,
      axisPointer: { type: 'line' as const, lineStyle: { color: p.axis, width: 1 } },
      formatter: (params: unknown) => {
        const first = (params as { name: string; value: number }[])[0];
        return first ? `${first.name}<br/><b>${formatNumber(first.value, ctx.lang)}</b>` : '';
      },
    },
    xAxis: {
      type: 'category' as const,
      data: result.labels,
      boundaryGap: false,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: p.axis } },
      axisLabel: { color: p.faint, hideOverlap: true },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: { color: p.faint, formatter: (v: number) => formatNumber(v, ctx.lang, true) },
      splitLine: { lineStyle: { color: p.grid, width: 1 } },
    },
    series: [
      {
        type: 'line' as const,
        data: result.values,
        showSymbol: result.values.length <= 40,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { width: 2, color: p.series[0] },
        itemStyle: { color: p.series[0], borderColor: p.surface, borderWidth: 2 },
      },
    ],
  };
}

function scatter(result: Extract<ChartResult, { kind: 'scatter' }>, ctx: OptionContext) {
  const { p, common, tooltip } = base(ctx);
  return {
    ...common,
    grid: { left: 8, right: 16, top: 16, bottom: 24, containLabel: true },
    tooltip: {
      ...tooltip,
      trigger: 'item' as const,
      formatter: (params: unknown) => {
        const [x, y] = (params as { value: [number, number] }).value;
        return `${ctx.xName ?? ''}: <b>${formatNumber(x, ctx.lang)}</b><br/>${ctx.yName ?? ''}: <b>${formatNumber(y, ctx.lang)}</b>`;
      },
    },
    xAxis: {
      type: 'value' as const,
      name: ctx.xName,
      nameLocation: 'middle' as const,
      nameGap: 28,
      axisLabel: { color: p.faint, formatter: (v: number) => formatNumber(v, ctx.lang, true) },
      splitLine: { lineStyle: { color: p.grid, width: 1 } },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: { color: p.faint, formatter: (v: number) => formatNumber(v, ctx.lang, true) },
      splitLine: { lineStyle: { color: p.grid, width: 1 } },
    },
    series: [
      {
        type: 'scatter' as const,
        data: result.points,
        symbolSize: 8,
        itemStyle: { color: p.series[0], opacity: 0.7, borderColor: p.surface, borderWidth: 1 },
      },
    ],
  };
}

/** Builds an ECharts option for a chart result. KPIs have no chart. */
export function buildOption(result: ChartResult, ctx: OptionContext) {
  switch (result.kind) {
    case 'bar':
      return horizontalBars(result, ctx, false);
    case 'distribution':
      return horizontalBars(result, ctx, true);
    case 'line':
      return line(result, ctx);
    case 'scatter':
      return scatter(result, ctx);
    case 'kpi':
      return null;
  }
}
