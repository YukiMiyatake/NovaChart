import { useMemo } from 'react';
import { YAxisConfig, YAxisZoom } from './useYAxisConfig';

interface ChartDataWithBrush {
  data: any[];
  brushStartIndex?: number;
  brushEndIndex?: number;
  goalData?: any[]; // For LP chart
}

export interface YAxisConfigOptions {
  defaultDomain: [number, number];
  defaultTicks: number[];
  dataKeys: string[];
  paddingRatio: number;
  minPadding: number;
  roundingFunctionMin: (value: number, interval: number) => number;
  roundingFunctionMax: (value: number, interval: number) => number;
  tickIntervalCalculator: (range: number) => number;
  useSetForTicks?: boolean; // For CS chart which uses Set
  tickRoundingFunction?: (value: number) => number; // For CS chart
}

export function useGenericYAxisConfig<T extends ChartDataWithBrush>(
  chartData: T,
  brushStartIndex: number | undefined,
  brushEndIndex: number | undefined,
  yAxisZoom: YAxisZoom | null,
  options: YAxisConfigOptions,
  ignoreYAxisZoom?: boolean
): YAxisConfig {
  return useMemo(() => {
    if (!chartData.data || chartData.data.length === 0) {
      return {
        yAxisDomain: options.defaultDomain,
        yAxisTicks: options.defaultTicks,
      };
    }

    const effectiveStartIndex = brushStartIndex ?? chartData.brushStartIndex ?? 0;
    const effectiveEndIndex = brushEndIndex ?? chartData.brushEndIndex ?? chartData.data.length - 1;
    
    const displayedStart = Math.max(0, Math.min(effectiveStartIndex, chartData.data.length - 1));
    const displayedEnd = Math.max(displayedStart, Math.min(effectiveEndIndex, chartData.data.length - 1));
    const displayedData = chartData.data.slice(displayedStart, displayedEnd + 1);

    // Extract values from displayed data using dataKeys
    const values: number[] = [];
    displayedData.forEach((d: any) => {
      options.dataKeys.forEach((key) => {
        const value = d[key];
        if (!isNaN(value) && value !== undefined) {
          values.push(value);
        }
      });
    });

    // For LP chart, also extract goal values
    if (chartData.goalData && displayedData.length > 0) {
      chartData.goalData.forEach((goalItem: any, index: number) => {
        const goalDataKey = `goalLineLP_${index}`;
        displayedData.forEach((d: any) => {
          const goalValue = d[goalDataKey];
          if (!isNaN(goalValue) && goalValue !== undefined) {
            values.push(goalValue);
          }
        });
      });
    }

    if (values.length === 0) {
      return {
        yAxisDomain: options.defaultDomain,
        yAxisTicks: options.defaultTicks,
      };
    }

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue;

    const padding = Math.max(options.minPadding, range * options.paddingRatio);
    const tickInterval = options.tickIntervalCalculator(range);
    const roundedMin = options.roundingFunctionMin(minValue - padding, tickInterval);
    const roundedMax = options.roundingFunctionMax(maxValue + padding, tickInterval);

    const baseYAxisDomain: [number, number] = [Math.max(0, roundedMin), roundedMax];
    
    const yAxisDomain = (yAxisZoom && !ignoreYAxisZoom)
      ? [Math.max(0, yAxisZoom.min), yAxisZoom.max] as [number, number]
      : baseYAxisDomain;

    // Generate Y-axis ticks
    const generateYTicks = () => {
      const [domainMin, domainMax] = yAxisDomain;
      const domainRange = domainMax - domainMin;
      const interval = options.tickIntervalCalculator(domainRange);

      if (options.useSetForTicks && options.tickRoundingFunction) {
        // CS chart style: use Set and custom rounding
        const tickSet = new Set<number>();
        let startTick = Math.floor(domainMin / interval) * interval;
        let endTick = Math.ceil(domainMax / interval) * interval;
        
        if (startTick >= domainMin) {
          startTick -= interval;
        }
        if (endTick <= domainMax) {
          endTick += interval;
        }
        
        let currentTick = startTick;
        while (currentTick <= endTick) {
          const roundedTick = options.tickRoundingFunction(currentTick);
          if (roundedTick >= domainMin - interval && roundedTick <= domainMax + interval) {
            tickSet.add(roundedTick);
          }
          currentTick += interval;
        }

        const roundedMin = options.tickRoundingFunction(domainMin);
        const roundedMax = options.tickRoundingFunction(domainMax);
        tickSet.add(roundedMin);
        tickSet.add(roundedMax);

        const ticks = Array.from(tickSet).sort((a, b) => a - b);

        if (ticks.length < 3) {
          const midPoint = (domainMin + domainMax) / 2;
          const midTick = options.tickRoundingFunction(Math.round(midPoint / interval) * interval);
          if (!tickSet.has(midTick)) {
            ticks.push(midTick);
            ticks.sort((a, b) => a - b);
          }
        }

        return ticks;
      } else {
        // LP and Damage chart style: simple array
        const ticks: number[] = [];
        let currentTick = Math.ceil(domainMin / interval) * interval;
        while (currentTick <= domainMax) {
          ticks.push(currentTick);
          currentTick += interval;
        }

        if (ticks.length < 3) {
          const midPoint = (domainMin + domainMax) / 2;
          ticks.push(Math.round(midPoint / interval) * interval);
          ticks.sort((a, b) => a - b);
        }

        return ticks;
      }
    };

    const yAxisTicks = generateYTicks();

    return {
      yAxisDomain,
      yAxisTicks,
    };
  }, [
    chartData.data,
    chartData.data?.length,
    chartData.brushStartIndex,
    chartData.brushEndIndex,
    chartData.goalData,
    chartData.goalData?.length,
    brushStartIndex,
    brushEndIndex,
    yAxisZoom,
    ignoreYAxisZoom,
    options.defaultDomain,
    options.defaultTicks,
    options.dataKeys,
    options.paddingRatio,
    options.minPadding,
    options.roundingFunctionMin,
    options.roundingFunctionMax,
  ]);
}

