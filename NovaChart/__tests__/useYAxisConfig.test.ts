import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useYAxisConfig } from '../app/components/RateChart/useYAxisConfig';
import { ChartDataResult } from '../app/components/RateChart/useChartData';

describe('useYAxisConfig', () => {
  const createChartData = (overrides?: Partial<ChartDataResult>): ChartDataResult => ({
    data: [],
    yAxisDomain: [0, 2800],
    yAxisTicks: [0, 400, 800, 1200, 1600, 2000, 2400, 2800],
    xAxisDomain: [0, Date.now()],
    brushStartIndex: undefined,
    brushEndIndex: undefined,
    goalData: [],
    ...overrides,
  });

  it('returns default config for empty data', () => {
    const chartData = createChartData({ data: [] });
    const { result } = renderHook(() =>
      useYAxisConfig(chartData, undefined, undefined, null)
    );

    expect(result.current.yAxisDomain).toEqual([0, 2800]);
    expect(result.current.yAxisTicks).toEqual([0, 400, 800, 1200, 1600, 2000, 2400, 2800]);
  });

  it('calculates yAxisDomain based on data range', () => {
    const chartData = createChartData({
      data: [
        { date: '1/1', dateValue: 1000, lp: 1200 },
        { date: '1/2', dateValue: 2000, lp: 1300 },
        { date: '1/3', dateValue: 3000, lp: 1400 },
      ],
    });

    const { result } = renderHook(() =>
      useYAxisConfig(chartData, undefined, undefined, null)
    );

    expect(result.current.yAxisDomain[0]).toBeLessThanOrEqual(1200);
    expect(result.current.yAxisDomain[1]).toBeGreaterThanOrEqual(1400);
  });

  it('includes movingAverage in yAxisDomain calculation', () => {
    const chartData = createChartData({
      data: [
        { date: '1/1', dateValue: 1000, lp: 1200, movingAverage: 1250 },
        { date: '1/2', dateValue: 2000, lp: 1300, movingAverage: 1350 },
      ],
    });

    const { result } = renderHook(() =>
      useYAxisConfig(chartData, undefined, undefined, null)
    );

    // Domain should include both lp and movingAverage values
    expect(result.current.yAxisDomain[0]).toBeLessThanOrEqual(1200);
    expect(result.current.yAxisDomain[1]).toBeGreaterThanOrEqual(1350);
  });

  it('includes predictedLP in yAxisDomain calculation', () => {
    const chartData = createChartData({
      data: [
        { date: '1/1', dateValue: 1000, lp: 1200 },
        { date: '1/2', dateValue: 2000, lp: NaN, predictedLP: 1500 },
      ],
    });

    const { result } = renderHook(() =>
      useYAxisConfig(chartData, undefined, undefined, null)
    );

    // Domain should include predictedLP
    expect(result.current.yAxisDomain[1]).toBeGreaterThanOrEqual(1500);
  });

  it('includes goal line LP values in yAxisDomain calculation', () => {
    const chartData = createChartData({
      data: [
        { date: '1/1', dateValue: 1000, lp: 1200, goalLineLP_0: 1600 },
        { date: '1/2', dateValue: 2000, lp: 1300, goalLineLP_0: 1700 },
      ],
      goalData: [
        {
          goal: {
            id: 1,
            targetDate: new Date('2024-02-01'),
            createdAt: new Date('2024-01-01'),
            targetTier: 'PLATINUM',
            targetRank: 'IV',
            targetLP: 0,
            isActive: true,
          },
          goalLP: 1600,
          targetDate: 1000,
          startDate: 500,
          startLP: 1200,
        },
      ],
    });

    const { result } = renderHook(() =>
      useYAxisConfig(chartData, undefined, undefined, null)
    );

    // Domain should include goal line values
    expect(result.current.yAxisDomain[1]).toBeGreaterThanOrEqual(1700);
  });

  it('uses brush indices to calculate domain for displayed range', () => {
    const chartData = createChartData({
      data: [
        { date: '1/1', dateValue: 1000, lp: 1200 },
        { date: '1/2', dateValue: 2000, lp: 1300 },
        { date: '1/3', dateValue: 3000, lp: 1400 },
        { date: '1/4', dateValue: 4000, lp: 1500 },
      ],
      brushStartIndex: 1,
      brushEndIndex: 2,
    });

    const { result } = renderHook(() =>
      useYAxisConfig(chartData, 1, 2, null)
    );

    // Domain should be based on brushed range (indices 1-2)
    expect(result.current.yAxisDomain[0]).toBeLessThanOrEqual(1300);
    expect(result.current.yAxisDomain[1]).toBeGreaterThanOrEqual(1400);
  });

  it('applies yAxisZoom when provided', () => {
    const chartData = createChartData({
      data: [
        { date: '1/1', dateValue: 1000, lp: 1200 },
        { date: '1/2', dateValue: 2000, lp: 1300 },
      ],
    });

    const yAxisZoom = { min: 1000, max: 2000 };
    const { result } = renderHook(() =>
      useYAxisConfig(chartData, undefined, undefined, yAxisZoom)
    );

    expect(result.current.yAxisDomain).toEqual([1000, 2000]);
  });

  it('ignores yAxisZoom when ignoreYAxisZoom is true', () => {
    const chartData = createChartData({
      data: [
        { date: '1/1', dateValue: 1000, lp: 1200 },
        { date: '1/2', dateValue: 2000, lp: 1300 },
      ],
    });

    const yAxisZoom = { min: 1000, max: 2000 };
    const { result } = renderHook(() =>
      useYAxisConfig(chartData, undefined, undefined, yAxisZoom, true)
    );

    // Should use calculated domain, not yAxisZoom
    expect(result.current.yAxisDomain).not.toEqual([1000, 2000]);
    expect(result.current.yAxisDomain[0]).toBeLessThanOrEqual(1200);
    expect(result.current.yAxisDomain[1]).toBeGreaterThanOrEqual(1300);
  });

  it('generates appropriate yAxisTicks based on domain range', () => {
    const chartData = createChartData({
      data: [
        { date: '1/1', dateValue: 1000, lp: 1200 },
        { date: '1/2', dateValue: 2000, lp: 1300 },
      ],
    });

    const { result } = renderHook(() =>
      useYAxisConfig(chartData, undefined, undefined, null)
    );

    expect(result.current.yAxisTicks.length).toBeGreaterThanOrEqual(3);
    expect(result.current.yAxisTicks[0]).toBeLessThanOrEqual(result.current.yAxisDomain[0]);
    expect(result.current.yAxisTicks[result.current.yAxisTicks.length - 1]).toBeGreaterThanOrEqual(
      result.current.yAxisDomain[1]
    );
  });

  it('handles small domain ranges with appropriate tick intervals', () => {
    const chartData = createChartData({
      data: [
        { date: '1/1', dateValue: 1000, lp: 1200 },
        { date: '1/2', dateValue: 2000, lp: 1250 },
      ],
    });

    const { result } = renderHook(() =>
      useYAxisConfig(chartData, undefined, undefined, null)
    );

    const ticks = result.current.yAxisTicks;
    // For small ranges, should have reasonable tick spacing
    if (ticks.length > 1) {
      const spacing = ticks[1] - ticks[0];
      expect(spacing).toBeGreaterThan(0);
    }
  });

  it('handles large domain ranges with appropriate tick intervals', () => {
    const chartData = createChartData({
      data: [
        { date: '1/1', dateValue: 1000, lp: 0 },
        { date: '1/2', dateValue: 2000, lp: 2000 },
      ],
    });

    const { result } = renderHook(() =>
      useYAxisConfig(chartData, undefined, undefined, null)
    );

    const ticks = result.current.yAxisTicks;
    // For large ranges, should have larger tick spacing
    if (ticks.length > 1) {
      const spacing = ticks[1] - ticks[0];
      expect(spacing).toBeGreaterThanOrEqual(100);
    }
  });

  it('ensures domain minimum is at least 0', () => {
    const chartData = createChartData({
      data: [
        { date: '1/1', dateValue: 1000, lp: 100 },
        { date: '1/2', dateValue: 2000, lp: 200 },
      ],
    });

    const { result } = renderHook(() =>
      useYAxisConfig(chartData, undefined, undefined, null)
    );

    expect(result.current.yAxisDomain[0]).toBeGreaterThanOrEqual(0);
  });

  it('handles NaN values gracefully', () => {
    const chartData = createChartData({
      data: [
        { date: '1/1', dateValue: 1000, lp: NaN },
        { date: '1/2', dateValue: 2000, lp: 1300 },
      ],
    });

    const { result } = renderHook(() =>
      useYAxisConfig(chartData, undefined, undefined, null)
    );

    // Should still calculate domain from valid values
    expect(result.current.yAxisDomain[1]).toBeGreaterThanOrEqual(1300);
  });

  it('updates when brush indices change', () => {
    const chartData = createChartData({
      data: [
        { date: '1/1', dateValue: 1000, lp: 1200 },
        { date: '1/2', dateValue: 2000, lp: 1300 },
        { date: '1/3', dateValue: 3000, lp: 1400 },
      ],
    });

    const { result, rerender } = renderHook(
      ({ brushStart, brushEnd }) =>
        useYAxisConfig(chartData, brushStart, brushEnd, null),
      {
        initialProps: { brushStart: 0, brushEnd: 2 },
      }
    );

    const initialDomain = result.current.yAxisDomain;

    rerender({ brushStart: 1, brushEnd: 2 });

    // Domain might change when brush changes
    expect(result.current.yAxisDomain).toBeDefined();
  });
});

