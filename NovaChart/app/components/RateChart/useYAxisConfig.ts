import { useMemo } from 'react';
import { ChartDataResult } from './useChartData';
import { useGenericYAxisConfig, YAxisConfigOptions } from './useGenericYAxisConfig';

export interface YAxisConfig {
  yAxisDomain: [number, number];
  yAxisTicks: number[];
}

export interface YAxisZoom {
  min: number;
  max: number;
}

const lpYAxisOptions: YAxisConfigOptions = {
  defaultDomain: [0, 2800],
  defaultTicks: [0, 400, 800, 1200, 1600, 2000, 2400, 2800],
  dataKeys: ['lp', 'movingAverage', 'predictedLP'],
  paddingRatio: 0.05,
  minPadding: 20,
  roundingFunctionMin: (value: number, interval: number) => {
    return Math.floor(value / interval) * interval;
  },
  roundingFunctionMax: (value: number, interval: number) => {
    return Math.ceil(value / interval) * interval;
  },
  tickIntervalCalculator: (range: number) => {
    if (range <= 200) return 25;
    if (range <= 500) return 50;
    if (range <= 1000) return 100;
    return 200;
  },
};

export function useYAxisConfig(
  chartData: ChartDataResult,
  brushStartIndex: number | undefined,
  brushEndIndex: number | undefined,
  yAxisZoom: YAxisZoom | null,
  ignoreYAxisZoom?: boolean // When true, ignore yAxisZoom and use baseYAxisDomain
): YAxisConfig {
  return useGenericYAxisConfig(
    chartData,
    brushStartIndex,
    brushEndIndex,
    yAxisZoom,
    lpYAxisOptions,
    ignoreYAxisZoom
  );
}

