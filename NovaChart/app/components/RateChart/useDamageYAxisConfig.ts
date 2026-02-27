import { DamageChartDataResult } from './useDamageChartData';
import { YAxisZoom, YAxisConfig } from './useYAxisConfig';
import { useGenericYAxisConfig, YAxisConfigOptions } from './useGenericYAxisConfig';

export type DamageYAxisConfig = YAxisConfig;

const damageYAxisOptions: YAxisConfigOptions = {
  defaultDomain: [0, 1000],
  defaultTicks: [0, 200, 400, 600, 800, 1000],
  dataKeys: ['damagePerMin', 'movingAverage'],
  paddingRatio: 0.1,
  minPadding: 50,
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
    if (range <= 2000) return 200;
    return 500;
  },
  useSetForTicks: true,
  tickRoundingFunction: (value: number) => Math.round(value),
};

export function useDamageYAxisConfig(
  chartData: DamageChartDataResult,
  brushStartIndex: number | undefined,
  brushEndIndex: number | undefined,
  yAxisZoom: YAxisZoom | null
): DamageYAxisConfig {
  return useGenericYAxisConfig(
    chartData,
    brushStartIndex,
    brushEndIndex,
    yAxisZoom,
    damageYAxisOptions
  );
}

