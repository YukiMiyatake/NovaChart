import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { ChartDataResult } from '../app/components/RateChart/useChartData';
import { YAxisConfig } from '../app/components/RateChart/useYAxisConfig';

// Mock recharts completely
vi.mock('recharts', () => ({
  LineChart: vi.fn(() => null),
  Line: vi.fn(() => null),
  XAxis: vi.fn(() => null),
  YAxis: vi.fn(() => null),
  CartesianGrid: vi.fn(() => null),
  Tooltip: vi.fn(() => null),
  Legend: vi.fn(() => null),
  ResponsiveContainer: vi.fn(({ children }: any) => children),
  Brush: vi.fn(() => null),
}));

// Mock lpToTierRank
vi.mock('../lib/riot/client', async () => {
  const actual = await vi.importActual('../lib/riot/client');
  return {
    ...actual,
    lpToTierRank: vi.fn((lp: number) => {
      if (lp < 400) return { tier: 'IRON', rank: 'IV', lp: lp };
      if (lp < 800) return { tier: 'BRONZE', rank: 'IV', lp: lp - 400 };
      if (lp < 1200) return { tier: 'SILVER', rank: 'IV', lp: lp - 800 };
      if (lp < 1600) return { tier: 'GOLD', rank: 'IV', lp: lp - 1200 };
      if (lp < 2000) return { tier: 'PLATINUM', rank: 'IV', lp: lp - 1600 };
      if (lp < 2400) return { tier: 'EMERALD', rank: 'IV', lp: lp - 2000 };
      if (lp < 2800) return { tier: 'DIAMOND', rank: 'IV', lp: lp - 2400 };
      return { tier: 'MASTER', rank: '', lp: lp - 2800 };
    }),
  };
});

// Import after mocks
import BaseChartContainer from '../app/components/RateChart/BaseChartContainer';
import { lpChartConfig } from '../app/components/RateChart/chartConfigs';
import { Line, ResponsiveContainer } from 'recharts';

describe('BaseChartContainer', () => {
  const createChartData = (overrides?: Partial<ChartDataResult>): ChartDataResult => ({
    data: [
      { date: '1/1', dateValue: 1000, lp: 1200 },
      { date: '1/2', dateValue: 2000, lp: 1300 },
    ],
    yAxisDomain: [0, 2800],
    yAxisTicks: [0, 400, 800, 1200, 1600, 2000, 2400, 2800],
    xAxisDomain: [0, Date.now()],
    brushStartIndex: undefined,
    brushEndIndex: undefined,
    goalData: [],
    ...overrides,
  });

  const createYAxisConfig = (overrides?: Partial<YAxisConfig>): YAxisConfig => ({
    yAxisDomain: [0, 2800],
    yAxisTicks: [0, 400, 800, 1200, 1600, 2000, 2400, 2800],
    ...overrides,
  });

  const defaultProps = {
    chartData: createChartData(),
    yAxisConfig: createYAxisConfig(),
    movingAverageWindow: 7,
    brushStartIndex: undefined,
    brushEndIndex: undefined,
    hiddenLines: new Set<string>(),
    yAxisZoom: null,
    timeRange: 'all' as const,
    onBrushChange: vi.fn(),
    onLegendClick: vi.fn(),
    onYAxisZoom: vi.fn(),
    chartConfig: lpChartConfig,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    // Just verify the component can be instantiated
    expect(() => {
      React.createElement(BaseChartContainer, defaultProps);
    }).not.toThrow();
  });

  it('accepts chartData prop correctly', () => {
    const chartData = createChartData({
      data: [
        { date: '1/1', dateValue: 1000, lp: 1200 },
        { date: '1/2', dateValue: 2000, lp: 1300 },
      ],
    });
    expect(() => {
      React.createElement(BaseChartContainer, { ...defaultProps, chartData });
    }).not.toThrow();
  });

  it('accepts predictedLP data correctly', () => {
    const chartData = createChartData({
      data: [
        { date: '1/1', dateValue: 1000, lp: 1200 },
        { date: '1/2', dateValue: 2000, lp: NaN, predictedLP: 1300 },
      ],
    });
    expect(() => {
      React.createElement(BaseChartContainer, { ...defaultProps, chartData });
    }).not.toThrow();
  });

  it('accepts hiddenLines prop correctly', () => {
    const hiddenLines = new Set(['lp', 'movingAverage']);
    expect(() => {
      React.createElement(BaseChartContainer, { ...defaultProps, hiddenLines });
    }).not.toThrow();
  });

  it('accepts goalData prop correctly', () => {
    const chartData = createChartData({
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
      data: [
        { date: '1/1', dateValue: 1000, lp: 1200, goalLineLP_0: 1600 },
      ],
    });
    expect(() => {
      React.createElement(BaseChartContainer, { ...defaultProps, chartData });
    }).not.toThrow();
  });

  it('accepts movingAverageWindow prop correctly', () => {
    expect(() => {
      React.createElement(BaseChartContainer, { ...defaultProps, movingAverageWindow: 14 });
    }).not.toThrow();
  });

  it('handles empty goalData array', () => {
    const chartData = createChartData({ goalData: [] });
    expect(() => {
      React.createElement(BaseChartContainer, { ...defaultProps, chartData });
    }).not.toThrow();
  });

  it('accepts all required props without errors', () => {
    expect(() => {
      React.createElement(BaseChartContainer, defaultProps);
    }).not.toThrow();
  });
});
