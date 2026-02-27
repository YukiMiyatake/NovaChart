import { CSChartDataResult } from './useCSChartData';
import { YAxisZoom, YAxisConfig } from './useYAxisConfig';
import { useGenericYAxisConfig, YAxisConfigOptions } from './useGenericYAxisConfig';

export type CSYAxisConfig = YAxisConfig;

const csYAxisOptions: YAxisConfigOptions = {
  defaultDomain: [0, 10],
  defaultTicks: [0, 2, 4, 6, 8, 10],
  dataKeys: ['csPerMin', 'movingAverage'],
  paddingRatio: 0.1,
  minPadding: 0.5,
  roundingFunctionMin: (value: number, interval: number) => {
    return Math.floor(value / interval) * interval;
  },
  roundingFunctionMax: (value: number, interval: number) => {
    return Math.ceil(value / interval) * interval;
  },
  tickIntervalCalculator: (range: number) => {
    if (range <= 1) return 0.1;
    if (range <= 3) return 0.5;
    if (range <= 10) return 1;
    if (range <= 20) return 2;
    return 5;
  },
  useSetForTicks: true,
  tickRoundingFunction: (value: number) => Math.round(value * 10) / 10,
};

export function useCSYAxisConfig(
  chartData: CSChartDataResult,
  brushStartIndex: number | undefined,
  brushEndIndex: number | undefined,
  yAxisZoom: YAxisZoom | null
): CSYAxisConfig {
  return useGenericYAxisConfig(
    chartData,
    brushStartIndex,
    brushEndIndex,
    yAxisZoom,
    csYAxisOptions
  );
}

