/**
 * Match Rating System
 * 
 * 試合のパフォーマンスを総合的に評価し、S, A, B, C, Dのランクを付与します。
 * KDA、CS、ダメージ、ビジョンスコア、キル参加率などを総合的に評価します。
 */

import { Match } from '@/types';

export type MatchRating = 'S' | 'A' | 'B' | 'C' | 'D';

export interface MatchRatingResult {
  rating: MatchRating;
  score: number; // 0-100のスコア
  breakdown: {
    kdaScore: number;
    csScore: number;
    damageScore: number;
    visionScore: number;
    participationScore: number;
  };
}

/**
 * 試合のパフォーマンスを評価
 * @param match 評価する試合データ
 * @param lane レーン（レーン別の基準値を使用するため）
 * @returns 評価結果
 */
export function rateMatch(match: Match, lane?: string): MatchRatingResult {
  const scores = {
    kdaScore: calculateKDAScore(match),
    csScore: calculateCSScore(match, lane),
    damageScore: calculateDamageScore(match, lane),
    visionScore: calculateVisionScore(match, lane),
    participationScore: calculateParticipationScore(match),
  };

  // 各スコアの重み付け平均
  // KDA: 30%, CS: 20%, Damage: 25%, Vision: 15%, Participation: 10%
  const totalScore = 
    scores.kdaScore * 0.30 +
    scores.csScore * 0.20 +
    scores.damageScore * 0.25 +
    scores.visionScore * 0.15 +
    scores.participationScore * 0.10;

  const rating = scoreToRating(totalScore);

  return {
    rating,
    score: Math.round(totalScore),
    breakdown: scores,
  };
}

/**
 * KDAスコアを計算（0-100）
 */
function calculateKDAScore(match: Match): number {
  if (!match.kda) return 50; // デフォルトスコア

  const { kills, deaths, assists } = match.kda;
  
  // デスが0の場合は最大スコア
  if (deaths === 0) {
    return 100;
  }

  // KDA比率を計算
  const kdaRatio = (kills + assists) / deaths;

  // KDA比率をスコアに変換
  // 3.0以上 = 100点, 2.0 = 80点, 1.5 = 60点, 1.0 = 40点, 0.5 = 20点
  if (kdaRatio >= 3.0) return 100;
  if (kdaRatio >= 2.5) return 90;
  if (kdaRatio >= 2.0) return 80;
  if (kdaRatio >= 1.5) return 70;
  if (kdaRatio >= 1.2) return 60;
  if (kdaRatio >= 1.0) return 50;
  if (kdaRatio >= 0.8) return 40;
  if (kdaRatio >= 0.5) return 30;
  return 20;
}

/**
 * CSスコアを計算（0-100）
 * レーン別の基準値を使用
 */
function calculateCSScore(match: Match, lane?: string): number {
  if (!match.csPerMin) return 50;

  // レーン別の基準CS/分
  const laneCSStandards: Record<string, { excellent: number; good: number; average: number }> = {
    'TOP': { excellent: 7.5, good: 6.5, average: 5.5 },
    'JUNGLE': { excellent: 5.5, good: 4.5, average: 3.5 },
    'MID': { excellent: 8.0, good: 7.0, average: 6.0 },
    'ADC': { excellent: 8.5, good: 7.5, average: 6.5 },
    'SUPPORT': { excellent: 2.0, good: 1.5, average: 1.0 },
  };

  const standards = lane && laneCSStandards[lane] 
    ? laneCSStandards[lane]
    : { excellent: 7.0, good: 6.0, average: 5.0 }; // デフォルト

  const csPerMin = match.csPerMin;

  if (csPerMin >= standards.excellent) return 100;
  if (csPerMin >= standards.good) return 80;
  if (csPerMin >= standards.average) return 60;
  if (csPerMin >= standards.average * 0.8) return 40;
  return 20;
}

/**
 * ダメージスコアを計算（0-100）
 * レーン別の基準値を使用
 */
function calculateDamageScore(match: Match, lane?: string): number {
  if (!match.damageToChampions) return 50;

  const gameDuration = match.gameDuration || 1800; // デフォルト30分
  const gameDurationMinutes = gameDuration / 60;
  const damagePerMin = match.damageToChampions / gameDurationMinutes;

  // レーン別の基準ダメージ/分
  const laneDamageStandards: Record<string, { excellent: number; good: number; average: number }> = {
    'TOP': { excellent: 600, good: 500, average: 400 },
    'JUNGLE': { excellent: 500, good: 400, average: 300 },
    'MID': { excellent: 700, good: 600, average: 500 },
    'ADC': { excellent: 800, good: 700, average: 600 },
    'SUPPORT': { excellent: 300, good: 250, average: 200 },
  };

  const standards = lane && laneDamageStandards[lane]
    ? laneDamageStandards[lane]
    : { excellent: 600, good: 500, average: 400 }; // デフォルト

  if (damagePerMin >= standards.excellent) return 100;
  if (damagePerMin >= standards.good) return 80;
  if (damagePerMin >= standards.average) return 60;
  if (damagePerMin >= standards.average * 0.8) return 40;
  return 20;
}

/**
 * ビジョンスコアを計算（0-100）
 * レーン別の基準値を使用
 */
function calculateVisionScore(match: Match, lane?: string): number {
  if (!match.visionScore) return 50;

  const gameDuration = match.gameDuration || 1800;
  const gameDurationMinutes = gameDuration / 60;
  const visionPerMin = match.visionScore / gameDurationMinutes;

  // レーン別の基準ビジョンスコア/分
  const laneVisionStandards: Record<string, { excellent: number; good: number; average: number }> = {
    'TOP': { excellent: 2.0, good: 1.5, average: 1.0 },
    'JUNGLE': { excellent: 2.5, good: 2.0, average: 1.5 },
    'MID': { excellent: 2.0, good: 1.5, average: 1.0 },
    'ADC': { excellent: 1.5, good: 1.2, average: 0.8 },
    'SUPPORT': { excellent: 3.0, good: 2.5, average: 2.0 },
  };

  const standards = lane && laneVisionStandards[lane]
    ? laneVisionStandards[lane]
    : { excellent: 2.0, good: 1.5, average: 1.0 }; // デフォルト

  if (visionPerMin >= standards.excellent) return 100;
  if (visionPerMin >= standards.good) return 80;
  if (visionPerMin >= standards.average) return 60;
  if (visionPerMin >= standards.average * 0.8) return 40;
  return 20;
}

/**
 * キル参加率スコアを計算（0-100）
 */
function calculateParticipationScore(match: Match): number {
  if (!match.killParticipation) return 50;

  const participation = match.killParticipation;

  // キル参加率をスコアに変換
  // 70%以上 = 100点, 60% = 80点, 50% = 60点, 40% = 40点, 30% = 20点
  if (participation >= 70) return 100;
  if (participation >= 60) return 80;
  if (participation >= 50) return 60;
  if (participation >= 40) return 40;
  if (participation >= 30) return 20;
  return 10;
}

/**
 * スコア（0-100）をランクに変換
 */
function scoreToRating(score: number): MatchRating {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  return 'D';
}

/**
 * ランクの色を取得（表示用）
 */
export function getRatingColor(rating: MatchRating): string {
  switch (rating) {
    case 'S':
      return 'text-purple-600 dark:text-purple-400';
    case 'A':
      return 'text-blue-600 dark:text-blue-400';
    case 'B':
      return 'text-green-600 dark:text-green-400';
    case 'C':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'D':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
}

/**
 * ランクの背景色を取得（表示用）
 */
export function getRatingBgColor(rating: MatchRating): string {
  switch (rating) {
    case 'S':
      return 'bg-purple-100 dark:bg-purple-900';
    case 'A':
      return 'bg-blue-100 dark:bg-blue-900';
    case 'B':
      return 'bg-green-100 dark:bg-green-900';
    case 'C':
      return 'bg-yellow-100 dark:bg-yellow-900';
    case 'D':
      return 'bg-red-100 dark:bg-red-900';
    default:
      return 'bg-gray-100 dark:bg-gray-900';
  }
}

