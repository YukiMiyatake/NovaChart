import { describe, it, expect } from 'vitest';
import {
  rateMatch,
  getRatingColor,
  getRatingBgColor,
  type MatchRating,
} from '../lib/analytics/matchRating';
import { Match } from '../types';

const createMatch = (overrides: Partial<Match> = {}): Match => ({
  matchId: 'test-match-1',
  date: new Date(),
  win: true,
  ...overrides,
});

describe('matchRating', () => {
  describe('rateMatch', () => {
    it('returns rating and score for match with KDA', () => {
      const match = createMatch({
        kda: { kills: 10, deaths: 2, assists: 8 },
        csPerMin: 7,
        damageToChampions: 20000,
        visionScore: 25,
        killParticipation: 70,
      });
      const result = rateMatch(match);
      expect(result.rating).toMatch(/^[SABCD]$/);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.breakdown).toHaveProperty('kdaScore');
      expect(result.breakdown).toHaveProperty('csScore');
      expect(result.breakdown).toHaveProperty('damageScore');
      expect(result.breakdown).toHaveProperty('visionScore');
      expect(result.breakdown).toHaveProperty('participationScore');
    });

    it('returns default scores when match has minimal data', () => {
      const match = createMatch({});
      const result = rateMatch(match);
      expect(result.rating).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('returns higher rating for excellent KDA (no deaths)', () => {
      const match = createMatch({
        kda: { kills: 5, deaths: 0, assists: 10 },
      });
      const result = rateMatch(match);
      expect(result.breakdown.kdaScore).toBe(100);
    });

    it('accepts optional lane parameter', () => {
      const match = createMatch({
        lane: 'MID',
        csPerMin: 7.5,
        kda: { kills: 4, deaths: 2, assists: 5 },
      });
      const result = rateMatch(match, 'MID');
      expect(result.rating).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getRatingColor', () => {
    it('returns Tailwind class for S rating', () => {
      expect(getRatingColor('S')).toContain('purple');
    });
    it('returns Tailwind class for A rating', () => {
      expect(getRatingColor('A')).toContain('blue');
    });
    it('returns Tailwind class for B rating', () => {
      expect(getRatingColor('B')).toContain('green');
    });
    it('returns Tailwind class for C rating', () => {
      expect(getRatingColor('C')).toContain('yellow');
    });
    it('returns Tailwind class for D rating', () => {
      expect(getRatingColor('D')).toContain('red');
    });
    it('returns gray for unknown rating', () => {
      const result = getRatingColor('X' as MatchRating);
      expect(result).toContain('gray');
    });
  });

  describe('getRatingBgColor', () => {
    it('returns background class for S rating', () => {
      expect(getRatingBgColor('S')).toContain('bg-');
      expect(getRatingBgColor('S')).toContain('purple');
    });
    it('returns background class for each rating', () => {
      const ratings: MatchRating[] = ['S', 'A', 'B', 'C', 'D'];
      ratings.forEach((r) => {
        const bg = getRatingBgColor(r);
        expect(bg).toMatch(/^bg-\w+-\d+/);
      });
    });
    it('returns gray background for unknown rating', () => {
      const result = getRatingBgColor('X' as MatchRating);
      expect(result).toContain('gray');
    });
  });
});
