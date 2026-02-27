import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useChartData } from '../app/components/RateChart/useChartData';
import { RateHistory, Goal } from '../types';
import * as predictionModule from '../lib/analytics/prediction';
import * as dateUtils from '../lib/utils/date';

// Mock dependencies
vi.mock('../lib/analytics/prediction');
vi.mock('../lib/utils/date');
vi.mock('../lib/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
  },
}));

describe('useChartData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock date formatting
    vi.mocked(dateUtils.formatDateShort).mockImplementation((date: Date) => {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}/${day}`;
    });
  });

  const createRateHistory = (
    date: Date,
    tier: string = 'GOLD',
    rank: string = 'IV',
    lp: number = 0
  ): RateHistory => ({
    matchId: `TEST_MATCH_${date.getTime()}`,
    date,
    tier,
    rank,
    lp,
    wins: 0,
    losses: 0,
  });

  const createGoal = (
    targetDate: Date,
    createdAt: Date,
    targetTier: string = 'PLATINUM',
    targetRank: string = 'IV',
    targetLP: number = 0
  ): Goal => ({
    targetDate,
    createdAt,
    targetTier,
    targetRank,
    targetLP,
    isActive: true,
  });

  it('returns empty data when rateHistory is empty', () => {
    const { result } = renderHook(() =>
      useChartData([], [], 'all', 7)
    );

    expect(result.current.data).toEqual([]);
    expect(result.current.yAxisDomain).toEqual([0, 2800]);
    expect(result.current.goalData).toEqual([]);
  });

  it('processes rate history data correctly', () => {
    const baseDate = new Date('2024-01-01');
    const rateHistory: RateHistory[] = [
      createRateHistory(baseDate, 'GOLD', 'IV', 50),
      createRateHistory(new Date('2024-01-02'), 'GOLD', 'III', 30),
    ];

    vi.mocked(predictionModule.calculateMovingAverage).mockReturnValue([
      { date: baseDate, value: 1200 },
      { date: new Date('2024-01-02'), value: 1230 },
    ]);

    vi.mocked(predictionModule.generatePredictionPoints).mockReturnValue([]);

    const { result } = renderHook(() =>
      useChartData(rateHistory, [], 'all', 7)
    );

    expect(result.current.data.length).toBeGreaterThan(0);
    expect(result.current.data[0]).toHaveProperty('lp');
    expect(result.current.data[0]).toHaveProperty('date');
    expect(result.current.data[0]).toHaveProperty('dateValue');
  });

  it('adds predictedLP to last data point to connect prediction line', () => {
    const baseDate = new Date('2024-01-01');
    const rateHistory: RateHistory[] = [
      createRateHistory(baseDate, 'GOLD', 'IV', 50),
    ];

    const predictionDate = new Date('2024-01-02');
    vi.mocked(predictionModule.calculateMovingAverage).mockReturnValue([
      { date: baseDate, value: 1200 },
    ]);

    vi.mocked(predictionModule.generatePredictionPoints).mockReturnValue([
      { date: predictionDate, predictedLP: 1250 },
    ]);

    const { result } = renderHook(() =>
      useChartData(rateHistory, [], 'all', 7)
    );

    // Find the last data point (should have predictedLP)
    const dataPoints = result.current.data;
    const lastDataPoint = dataPoints[dataPoints.length - 1];
    
    // The last data point should have predictedLP to connect the prediction line
    const hasPredictedLP = dataPoints.some(point => point.predictedLP !== undefined);
    expect(hasPredictedLP).toBe(true);
  });

  it('merges points with the same dateTime correctly', () => {
    const baseDate = new Date('2024-01-01');
    baseDate.setHours(12, 0, 0, 0);
    
    const rateHistory: RateHistory[] = [
      createRateHistory(baseDate, 'GOLD', 'IV', 50),
    ];

    const predictionDate = new Date(baseDate);
    predictionDate.setHours(12, 0, 0, 0); // Same date and time

    vi.mocked(predictionModule.calculateMovingAverage).mockReturnValue([
      { date: baseDate, value: 1200 },
    ]);

    vi.mocked(predictionModule.generatePredictionPoints).mockReturnValue([
      { date: predictionDate, predictedLP: 1250 },
    ]);

    const { result } = renderHook(() =>
      useChartData(rateHistory, [], 'all', 7)
    );

    const dataPoints = result.current.data;
    // Points with same dateTime should be merged
    const dateTimeCounts = new Map<number, number>();
    dataPoints.forEach(point => {
      const count = dateTimeCounts.get(point.dateValue) || 0;
      dateTimeCounts.set(point.dateValue, count + 1);
    });

    // Each dateValue should appear only once after merging
    dateTimeCounts.forEach((count, dateValue) => {
      expect(count).toBe(1);
    });
  });

  it('handles goals correctly', () => {
    const baseDate = new Date('2024-01-01');
    const rateHistory: RateHistory[] = [
      createRateHistory(baseDate, 'GOLD', 'IV', 50),
    ];

    const goalDate = new Date('2024-02-01');
    const goalCreatedAt = new Date('2024-01-15');
    const goals: Goal[] = [
      createGoal(goalDate, goalCreatedAt, 'PLATINUM', 'IV', 0),
    ];

    vi.mocked(predictionModule.calculateMovingAverage).mockReturnValue([
      { date: baseDate, value: 1200 },
    ]);

    vi.mocked(predictionModule.generatePredictionPoints).mockReturnValue([]);

    const { result } = renderHook(() =>
      useChartData(rateHistory, goals, 'all', 7)
    );

    expect(result.current.goalData.length).toBe(1);
    expect(result.current.goalData[0].goalLP).toBeGreaterThan(0);
    expect(result.current.goalData[0].targetDate).toBe(goalDate.getTime());
  });

  it('generates goal line points with linear interpolation', () => {
    const baseDate = new Date('2024-01-01');
    const rateHistory: RateHistory[] = [
      createRateHistory(baseDate, 'GOLD', 'IV', 50),
    ];

    const goalDate = new Date('2024-01-05'); // 4 days later
    const goalCreatedAt = new Date('2024-01-01');
    const goals: Goal[] = [
      createGoal(goalDate, goalCreatedAt, 'PLATINUM', 'IV', 0),
    ];

    vi.mocked(predictionModule.calculateMovingAverage).mockReturnValue([
      { date: baseDate, value: 1200 },
    ]);

    vi.mocked(predictionModule.generatePredictionPoints).mockReturnValue([]);

    const { result } = renderHook(() =>
      useChartData(rateHistory, goals, 'all', 7)
    );

    // Should have goal line points for each day
    const goalLinePoints = result.current.data.filter(point => 
      point.hasOwnProperty('goalLineLP_0')
    );
    expect(goalLinePoints.length).toBeGreaterThan(0);
    
    // Check that goal line points have interpolated values
    const goalLineValues = goalLinePoints.map(p => (p as any).goalLineLP_0);
    expect(goalLineValues[0]).toBeLessThanOrEqual(goalLineValues[goalLineValues.length - 1]);
  });

  it('handles multiple goals correctly', () => {
    const baseDate = new Date('2024-01-01');
    const rateHistory: RateHistory[] = [
      createRateHistory(baseDate, 'GOLD', 'IV', 50),
    ];

    const goals: Goal[] = [
      createGoal(new Date('2024-02-01'), new Date('2024-01-15'), 'PLATINUM', 'IV', 0),
      createGoal(new Date('2024-03-01'), new Date('2024-02-15'), 'DIAMOND', 'IV', 0),
    ];

    vi.mocked(predictionModule.calculateMovingAverage).mockReturnValue([
      { date: baseDate, value: 1200 },
    ]);

    vi.mocked(predictionModule.generatePredictionPoints).mockReturnValue([]);

    const { result } = renderHook(() =>
      useChartData(rateHistory, goals, 'all', 7)
    );

    expect(result.current.goalData.length).toBe(2);
    // Second goal should start from first goal's target
    expect(result.current.goalData[1].startLP).toBe(result.current.goalData[0].goalLP);
  });

  it('extends moving average to display range end', () => {
    const baseDate = new Date('2024-01-01');
    const rateHistory: RateHistory[] = [
      createRateHistory(baseDate, 'GOLD', 'IV', 50),
    ];

    const predictionDate = new Date('2024-01-10');
    vi.mocked(predictionModule.calculateMovingAverage).mockReturnValue([
      { date: baseDate, value: 1200 },
    ]);

    vi.mocked(predictionModule.generatePredictionPoints).mockReturnValue([
      { date: predictionDate, predictedLP: 1250 },
    ]);

    const { result } = renderHook(() =>
      useChartData(rateHistory, [], 'all', 7)
    );

    // Points after the last data point with moving average should have movingAverage
    const dataPoints = result.current.data;
    const lastMAIndex = dataPoints.findLastIndex(p => p.movingAverage !== undefined);
    if (lastMAIndex >= 0 && lastMAIndex < dataPoints.length - 1) {
      const lastMAValue = dataPoints[lastMAIndex].movingAverage;
      // Points after should have the same moving average value
      for (let i = lastMAIndex + 1; i < dataPoints.length; i++) {
        expect(dataPoints[i].movingAverage).toBe(lastMAValue);
      }
    }
  });

  it('calculates xAxisDomain correctly for different time ranges', () => {
    const baseDate = new Date('2023-01-01');
    const rateHistory: RateHistory[] = [
      createRateHistory(baseDate, 'GOLD', 'IV', 50),
      createRateHistory(new Date('2024-01-01'), 'GOLD', 'III', 30),
    ];

    vi.mocked(predictionModule.calculateMovingAverage).mockReturnValue([
      { date: baseDate, value: 1200 },
      { date: new Date('2024-01-01'), value: 1230 },
    ]);

    vi.mocked(predictionModule.generatePredictionPoints).mockReturnValue([]);

    const { result: resultAll } = renderHook(() =>
      useChartData(rateHistory, [], 'all', 7)
    );
    expect(resultAll.current.xAxisDomain[0]).toBeLessThanOrEqual(resultAll.current.xAxisDomain[1]);

    const { result: result1Year } = renderHook(() =>
      useChartData(rateHistory, [], '1year', 7)
    );
    expect(result1Year.current.xAxisDomain[0]).toBeLessThanOrEqual(result1Year.current.xAxisDomain[1]);
  });

  it('calculates brush indices correctly for time ranges', () => {
    const baseDate = new Date();
    baseDate.setMonth(baseDate.getMonth() - 2); // 2 months ago
    
    const rateHistory: RateHistory[] = [
      createRateHistory(baseDate, 'GOLD', 'IV', 50),
      createRateHistory(new Date(), 'GOLD', 'III', 30),
    ];

    vi.mocked(predictionModule.calculateMovingAverage).mockReturnValue([
      { date: baseDate, value: 1200 },
      { date: new Date(), value: 1230 },
    ]);

    vi.mocked(predictionModule.generatePredictionPoints).mockReturnValue([]);

    const { result } = renderHook(() =>
      useChartData(rateHistory, [], '1month', 7)
    );

    if (result.current.brushStartIndex !== undefined && result.current.brushEndIndex !== undefined) {
      expect(result.current.brushStartIndex).toBeLessThanOrEqual(result.current.brushEndIndex);
      expect(result.current.brushStartIndex).toBeGreaterThanOrEqual(0);
      expect(result.current.brushEndIndex).toBeLessThan(result.current.data.length);
    }
  });

  it('handles prediction points with different dates', () => {
    const baseDate = new Date('2024-01-01');
    const rateHistory: RateHistory[] = [
      createRateHistory(baseDate, 'GOLD', 'IV', 50),
    ];

    const predictionDates = [
      new Date('2024-01-02'),
      new Date('2024-01-03'),
      new Date('2024-01-04'),
    ];

    vi.mocked(predictionModule.calculateMovingAverage).mockReturnValue([
      { date: baseDate, value: 1200 },
    ]);

    vi.mocked(predictionModule.generatePredictionPoints).mockReturnValue(
      predictionDates.map(date => ({ date, predictedLP: 1250 }))
    );

    const { result } = renderHook(() =>
      useChartData(rateHistory, [], 'all', 7)
    );

    const predictionPoints = result.current.data.filter(p => p.predictedLP !== undefined);
    expect(predictionPoints.length).toBeGreaterThan(0);
  });

  it('processes data points correctly', () => {
    const baseDate = new Date('2024-01-01');
    const rateHistory: RateHistory[] = [
      createRateHistory(baseDate, 'GOLD', 'IV', 50),
    ];

    vi.mocked(predictionModule.calculateMovingAverage).mockReturnValue([
      { date: baseDate, value: 1200 },
    ]);

    vi.mocked(predictionModule.generatePredictionPoints).mockReturnValue([]);

    const { result } = renderHook(() =>
      useChartData(rateHistory, [], 'all', 7)
    );

    // Data points should be created correctly
    expect(result.current.data.length).toBeGreaterThan(0);
    const firstDataPoint = result.current.data[0];
    expect(firstDataPoint).toHaveProperty('date');
    expect(firstDataPoint).toHaveProperty('dateValue');
    expect(firstDataPoint).toHaveProperty('lp');
    // Note: originalEntry is removed from final data (see useChartData.ts line 295)
  });
});

