import { describe, it, expect } from 'vitest';
import {
  calculateLinearRegression,
  predictReachDate,
  calculateMovingAverage,
  generatePredictionPoints,
} from '../lib/analytics/prediction';
import { RateHistory } from '../types';

describe('prediction', () => {
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

  describe('calculateLinearRegression', () => {
    it('returns zero values for insufficient data', () => {
      const result = calculateLinearRegression([]);
      expect(result.slope).toBe(0);
      expect(result.intercept).toBe(0);
      expect(result.rSquared).toBe(0);
    });

    it('returns zero values for single data point', () => {
      const data = [createRateHistory(new Date('2024-01-01'), 'GOLD', 'IV', 50)];
      const result = calculateLinearRegression(data);
      expect(result.slope).toBe(0);
      expect(result.intercept).toBe(0);
      expect(result.rSquared).toBe(0);
    });

    it('calculates regression for upward trend', () => {
      const baseDate = new Date('2024-01-01');
      const data: RateHistory[] = [
        createRateHistory(baseDate, 'GOLD', 'IV', 0),
        createRateHistory(new Date('2024-01-02'), 'GOLD', 'III', 0),
        createRateHistory(new Date('2024-01-03'), 'GOLD', 'II', 0),
      ];

      const result = calculateLinearRegression(data);
      expect(result.slope).toBeGreaterThan(0);
      expect(result.rSquared).toBeGreaterThanOrEqual(0);
      expect(result.rSquared).toBeLessThanOrEqual(1);
    });

    it('calculates regression for downward trend', () => {
      const baseDate = new Date('2024-01-01');
      const data: RateHistory[] = [
        createRateHistory(baseDate, 'GOLD', 'II', 0),
        createRateHistory(new Date('2024-01-02'), 'GOLD', 'III', 0),
        createRateHistory(new Date('2024-01-03'), 'GOLD', 'IV', 0),
      ];

      const result = calculateLinearRegression(data);
      expect(result.slope).toBeLessThan(0);
      expect(result.rSquared).toBeGreaterThanOrEqual(0);
      expect(result.rSquared).toBeLessThanOrEqual(1);
    });

    it('handles same tier and rank with different LP', () => {
      const baseDate = new Date('2024-01-01');
      const data: RateHistory[] = [
        createRateHistory(baseDate, 'GOLD', 'IV', 0),
        createRateHistory(new Date('2024-01-02'), 'GOLD', 'IV', 50),
        createRateHistory(new Date('2024-01-03'), 'GOLD', 'IV', 100),
      ];

      const result = calculateLinearRegression(data);
      expect(result.slope).toBeGreaterThan(0);
    });
  });

  describe('predictReachDate', () => {
    it('returns null for insufficient data', () => {
      const result = predictReachDate([], 1500);
      expect(result).toBeNull();
    });

    it('returns null for non-improving trend', () => {
      const baseDate = new Date('2024-01-01');
      const data: RateHistory[] = [
        createRateHistory(baseDate, 'GOLD', 'II', 0),
        createRateHistory(new Date('2024-01-02'), 'GOLD', 'III', 0),
      ];

      const result = predictReachDate(data, 1500);
      expect(result).toBeNull();
    });

    it('predicts reach date for upward trend', () => {
      const baseDate = new Date('2024-01-01');
      const data: RateHistory[] = [
        createRateHistory(baseDate, 'GOLD', 'IV', 0),
        createRateHistory(new Date('2024-01-02'), 'GOLD', 'III', 0),
        createRateHistory(new Date('2024-01-03'), 'GOLD', 'II', 0),
      ];

      const result = predictReachDate(data, 1600); // PLATINUM IV
      expect(result).not.toBeNull();
      if (result) {
        expect(result.predictedLP).toBe(1600);
        expect(result.predictedDate.getTime()).toBeGreaterThan(data[data.length - 1].date.getTime());
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(100);
      }
    });

    it('returns null if target already passed', () => {
      const baseDate = new Date('2024-01-01');
      const data: RateHistory[] = [
        createRateHistory(baseDate, 'PLATINUM', 'IV', 0),
        createRateHistory(new Date('2024-01-02'), 'PLATINUM', 'III', 0),
      ];

      const result = predictReachDate(data, 1200); // GOLD IV (lower than current)
      expect(result).toBeNull();
    });
  });

  describe('calculateMovingAverage', () => {
    it('returns empty array for empty data', () => {
      const result = calculateMovingAverage([]);
      expect(result).toEqual([]);
    });

    it('calculates moving average with default window', () => {
      const baseDate = new Date('2024-01-01');
      const data: RateHistory[] = [
        createRateHistory(baseDate, 'GOLD', 'IV', 0),
        createRateHistory(new Date('2024-01-02'), 'GOLD', 'IV', 50),
        createRateHistory(new Date('2024-01-03'), 'GOLD', 'III', 0),
      ];

      const result = calculateMovingAverage(data);
      expect(result.length).toBe(data.length);
      result.forEach(avg => {
        expect(avg.value).toBeGreaterThanOrEqual(0);
        expect(avg.date).toBeInstanceOf(Date);
      });
    });

    it('calculates moving average with custom window', () => {
      const baseDate = new Date('2024-01-01');
      const data: RateHistory[] = Array.from({ length: 10 }, (_, i) =>
        createRateHistory(new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000), 'GOLD', 'IV', i * 10)
      );

      const result = calculateMovingAverage(data, 5);
      expect(result.length).toBe(data.length);
    });

    it('handles single data point', () => {
      const data = [createRateHistory(new Date('2024-01-01'), 'GOLD', 'IV', 50)];
      const result = calculateMovingAverage(data);
      expect(result.length).toBe(1);
      expect(result[0].value).toBeGreaterThanOrEqual(0);
    });

    it('sorts data before calculating', () => {
      const baseDate = new Date('2024-01-01');
      const data: RateHistory[] = [
        createRateHistory(new Date('2024-01-03'), 'GOLD', 'IV', 0),
        createRateHistory(baseDate, 'GOLD', 'IV', 0),
        createRateHistory(new Date('2024-01-02'), 'GOLD', 'IV', 50),
      ];

      const result = calculateMovingAverage(data);
      expect(result.length).toBe(data.length);
      // Values should be in chronological order
      for (let i = 1; i < result.length; i++) {
        expect(result[i].date.getTime()).toBeGreaterThanOrEqual(result[i - 1].date.getTime());
      }
    });
  });

  describe('generatePredictionPoints', () => {
    it('returns empty array for insufficient data', () => {
      const result = generatePredictionPoints([]);
      expect(result).toEqual([]);
    });

    it('returns empty array for single data point', () => {
      const data = [createRateHistory(new Date('2024-01-01'), 'GOLD', 'IV', 50)];
      const result = generatePredictionPoints(data);
      expect(result).toEqual([]);
    });

    it('generates prediction points for upward trend', () => {
      const baseDate = new Date('2024-01-01');
      const data: RateHistory[] = [
        createRateHistory(baseDate, 'GOLD', 'IV', 0),
        createRateHistory(new Date('2024-01-02'), 'GOLD', 'III', 0),
        createRateHistory(new Date('2024-01-03'), 'GOLD', 'II', 0),
      ];

      const result = generatePredictionPoints(data, 30);
      expect(result.length).toBe(31); // 0 to 30 days inclusive
      expect(result[0].date.getTime()).toBeGreaterThanOrEqual(data[data.length - 1].date.getTime());
      expect(result[result.length - 1].date.getTime()).toBeGreaterThan(result[0].date.getTime());
      
      // Check that predictedLP values are increasing (upward trend)
      for (let i = 1; i < result.length; i++) {
        expect(result[i].predictedLP).toBeGreaterThanOrEqual(result[i - 1].predictedLP);
      }
    });

    it('generates prediction points for downward trend', () => {
      const baseDate = new Date('2024-01-01');
      const data: RateHistory[] = [
        createRateHistory(baseDate, 'GOLD', 'II', 0),
        createRateHistory(new Date('2024-01-02'), 'GOLD', 'III', 0),
        createRateHistory(new Date('2024-01-03'), 'GOLD', 'IV', 0),
      ];

      const result = generatePredictionPoints(data, 30);
      expect(result.length).toBe(31);
      
      // Check that predictedLP values are decreasing (downward trend)
      for (let i = 1; i < result.length; i++) {
        expect(result[i].predictedLP).toBeLessThanOrEqual(result[i - 1].predictedLP);
      }
    });

    it('generates prediction points with custom daysAhead', () => {
      const baseDate = new Date('2024-01-01');
      const data: RateHistory[] = [
        createRateHistory(baseDate, 'GOLD', 'IV', 0),
        createRateHistory(new Date('2024-01-02'), 'GOLD', 'III', 0),
      ];

      const result = generatePredictionPoints(data, 7);
      expect(result.length).toBe(8); // 0 to 7 days inclusive
    });

    it('generates points starting from last data point date', () => {
      const baseDate = new Date('2024-01-01');
      const lastDate = new Date('2024-01-05');
      const data: RateHistory[] = [
        createRateHistory(baseDate, 'GOLD', 'IV', 0),
        createRateHistory(lastDate, 'GOLD', 'III', 0),
      ];

      const result = generatePredictionPoints(data, 10);
      expect(result.length).toBe(11);
      // First prediction point should be on or after the last data point
      expect(result[0].date.getTime()).toBeGreaterThanOrEqual(lastDate.getTime());
    });

    it('handles zero slope (no change)', () => {
      const baseDate = new Date('2024-01-01');
      const data: RateHistory[] = [
        createRateHistory(baseDate, 'GOLD', 'IV', 50),
        createRateHistory(new Date('2024-01-02'), 'GOLD', 'IV', 50),
        createRateHistory(new Date('2024-01-03'), 'GOLD', 'IV', 50),
      ];

      const result = generatePredictionPoints(data, 10);
      // Should still generate points even with zero slope
      expect(result.length).toBe(11);
      // All predictedLP values should be approximately the same
      const firstLP = result[0].predictedLP;
      result.forEach(point => {
        expect(Math.abs(point.predictedLP - firstLP)).toBeLessThan(1);
      });
    });
  });
});

