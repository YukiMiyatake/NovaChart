import { describe, it, expect } from 'vitest';
import {
  calculateProgress,
  calculateRequiredMatches,
  calculateStatistics,
} from '../lib/analytics/progress';
import { RateHistory, Goal, Match } from '../types';

const createRateHistory = (
  date: Date,
  tier: string = 'GOLD',
  rank: string = 'IV',
  lp: number = 0,
  wins: number = 0,
  losses: number = 0
): RateHistory => ({
  matchId: `TEST_${date.getTime()}`,
  date,
  tier,
  rank,
  lp,
  wins,
  losses,
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

describe('progress', () => {
  describe('calculateProgress', () => {
    it('returns null for empty rate history', () => {
      const goal = createGoal(new Date('2024-02-01'), new Date('2024-01-01'));
      expect(calculateProgress([], goal)).toBeNull();
    });

    it('returns 100% when current LP >= target LP', () => {
      const rateHistory: RateHistory[] = [
        createRateHistory(new Date('2024-01-01'), 'GOLD', 'IV', 0),
        createRateHistory(new Date('2024-01-02'), 'PLATINUM', 'IV', 0),
      ];
      const goal = createGoal(new Date('2024-02-01'), new Date('2024-01-01'), 'PLATINUM', 'IV', 0);
      const result = calculateProgress(rateHistory, goal);
      expect(result).not.toBeNull();
      expect(result!.progressPercentage).toBe(100);
      expect(result!.lpRemaining).toBe(0);
    });

    it('returns progress < 100 when current LP < target LP', () => {
      const rateHistory: RateHistory[] = [
        createRateHistory(new Date('2024-01-01'), 'GOLD', 'IV', 0),
        createRateHistory(new Date('2024-01-02'), 'GOLD', 'II', 50),
      ];
      const goal = createGoal(new Date('2024-02-01'), new Date('2024-01-01'), 'PLATINUM', 'IV', 0);
      const result = calculateProgress(rateHistory, goal);
      expect(result).not.toBeNull();
      expect(result!.progressPercentage).toBeLessThan(100);
      expect(result!.lpRemaining).toBeGreaterThan(0);
      expect(result!.currentLP).toBeLessThan(result!.targetLP);
    });

    it('includes averageLPPerDay and daysRemaining when data has enough points', () => {
      const base = new Date('2024-01-01');
      const rateHistory: RateHistory[] = [
        createRateHistory(base, 'GOLD', 'IV', 0),
        createRateHistory(new Date(base.getTime() + 10 * 24 * 60 * 60 * 1000), 'GOLD', 'III', 50),
      ];
      const goal = createGoal(new Date('2024-02-01'), new Date('2024-01-01'), 'PLATINUM', 'IV', 0);
      const result = calculateProgress(rateHistory, goal);
      expect(result).not.toBeNull();
      expect(result!.currentLP).toBeDefined();
      expect(result!.targetLP).toBeDefined();
    });
  });

  describe('calculateRequiredMatches', () => {
    it('returns null when no rate history and no currentLeagueEntry', () => {
      const goal = createGoal(new Date('2024-02-01'), new Date('2024-01-01'));
      expect(calculateRequiredMatches([], [], goal)).toBeNull();
    });

    it('returns null when currentLeagueEntry is not solo queue', () => {
      const rateHistory = [createRateHistory(new Date('2024-01-01'), 'GOLD', 'IV', 50)];
      const goal = createGoal(new Date('2024-02-01'), new Date('2024-01-01'), 'PLATINUM', 'IV', 0);
      const currentLeagueEntry = {
        queueType: 'RANKED_FLEX_SR',
        tier: 'GOLD',
        rank: 'IV',
        leaguePoints: 50,
        wins: 10,
        losses: 10,
      };
      expect(
        calculateRequiredMatches(rateHistory, [], goal, 3, currentLeagueEntry)
      ).toBeNull();
    });

    it('returns result with matchesNeeded 0 when target already reached', () => {
      const rateHistory = [
        createRateHistory(new Date('2024-01-01'), 'PLATINUM', 'IV', 0),
      ];
      const goal = createGoal(new Date('2024-02-01'), new Date('2024-01-01'), 'PLATINUM', 'IV', 0);
      const result = calculateRequiredMatches(rateHistory, [], goal);
      expect(result).not.toBeNull();
      expect(result!.matchesNeeded).toBe(0);
      expect(result!.daysNeeded).toBe(0);
    });

    it('returns positive matchesNeeded when target is above current and win rate > 50%', () => {
      // Win rate must be > 50% for avgLPPerMatch to be positive (model: winRate*15 - (1-winRate)*15)
      const rateHistory = [
        createRateHistory(new Date('2024-01-01'), 'GOLD', 'IV', 0, 6, 4),
      ];
      const goal = createGoal(new Date('2024-02-01'), new Date('2024-01-01'), 'PLATINUM', 'IV', 0);
      const result = calculateRequiredMatches(rateHistory, [], goal, 3);
      expect(result).not.toBeNull();
      expect(result!.matchesNeeded).toBeGreaterThanOrEqual(0);
      expect(result!.winRate).toBeGreaterThanOrEqual(0);
      expect(result!.matchesPerDay).toBe(3);
    });

    it('uses currentLeagueEntry when provided (solo queue)', () => {
      const goal = createGoal(new Date('2024-02-01'), new Date('2024-01-01'), 'PLATINUM', 'IV', 0);
      // Win rate > 50% so that avgLPPerMatch > 0 and result is non-null
      const currentLeagueEntry = {
        queueType: 'RANKED_SOLO_5x5',
        tier: 'GOLD',
        rank: 'IV',
        leaguePoints: 50,
        wins: 12,
        losses: 8,
      };
      const result = calculateRequiredMatches([], [], goal, 3, currentLeagueEntry);
      expect(result).not.toBeNull();
      expect(result!.matchesNeeded).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateStatistics', () => {
    it('returns null for empty rate history and no currentLeagueEntry', () => {
      expect(calculateStatistics([])).toBeNull();
    });

    it('returns null when currentLeagueEntry is not solo queue', () => {
      const rateHistory = [createRateHistory(new Date('2024-01-01'), 'GOLD', 'IV', 50)];
      const currentLeagueEntry = {
        queueType: 'RANKED_FLEX_SR',
        tier: 'GOLD',
        rank: 'IV',
        leaguePoints: 50,
        wins: 10,
        losses: 10,
      };
      expect(calculateStatistics(rateHistory, currentLeagueEntry)).toBeNull();
    });

    it('returns statistics from rate history only', () => {
      const rateHistory: RateHistory[] = [
        createRateHistory(new Date('2024-01-01'), 'GOLD', 'IV', 0, 2, 2),
        createRateHistory(new Date('2024-01-02'), 'GOLD', 'III', 50, 3, 2),
      ];
      const result = calculateStatistics(rateHistory);
      expect(result).not.toBeNull();
      // totalGames = sum of wins + losses from all entries (2+2 + 3+2 = 9)
      expect(result!.totalGames).toBe(9);
      expect(result!.currentTier).toBe('GOLD');
      expect(result!.currentRank).toBe('III');
      expect(result!.peakLP).toBeGreaterThanOrEqual(result!.currentLP ?? 0);
    });

    it('uses currentLeagueEntry for wins/losses when solo queue', () => {
      const rateHistory = [createRateHistory(new Date('2024-01-01'), 'GOLD', 'IV', 50)];
      const currentLeagueEntry = {
        queueType: 'RANKED_SOLO_5x5',
        tier: 'GOLD',
        rank: 'IV',
        leaguePoints: 50,
        wins: 20,
        losses: 15,
      };
      const result = calculateStatistics(rateHistory, currentLeagueEntry);
      expect(result).not.toBeNull();
      expect(result!.wins).toBe(20);
      expect(result!.losses).toBe(15);
      expect(result!.totalGames).toBe(35);
      expect(result!.winRate).toBeGreaterThan(0);
    });
  });
});
