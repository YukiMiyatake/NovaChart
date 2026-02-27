import { useMemo } from 'react';
import { Match } from '@/types';
import { formatDateShort } from '@/lib/utils/date';
import { calculateMovingAverage } from '@/lib/analytics/prediction';
import { TimeRange } from './utils/timeRange';

export interface CSChartDataPoint {
  date: string;
  dateValue: number;
  csPerMin: number;
  movingAverage?: number;
}

export interface CSChartDataResult {
  data: CSChartDataPoint[];
  yAxisDomain: [number, number];
  yAxisTicks: number[];
  brushStartIndex: number | undefined;
  brushEndIndex: number | undefined;
}

export function useCSChartData(
  matches: Match[],
  timeRange: TimeRange,
  movingAverageWindow: number
): CSChartDataResult {
  return useMemo(() => {
    // Use ALL data (same as LP chart) - don't filter by timeRange here
    // Filtering is handled by Brush initialization
    if (matches.length === 0) {
      return {
        data: [],
        yAxisDomain: [0, 10],
        yAxisTicks: [0, 2, 4, 6, 8, 10],
        brushStartIndex: undefined,
        brushEndIndex: undefined,
      };
    }

    // 日付順にソート（全データを使用）
    const sorted = [...matches].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // CS/分のデータポイントを作成
    const dataPoints: CSChartDataPoint[] = sorted
      .filter(m => m.csPerMin !== undefined)
      .map((match) => {
        const dateTime = new Date(match.date).getTime();
        const date = new Date(match.date);
        const dateStr = formatDateShort(date);
        return {
          date: dateStr,
          dateValue: dateTime,
          csPerMin: match.csPerMin!,
        };
      });

    if (dataPoints.length === 0) {
      return {
        data: [],
        yAxisDomain: [0, 10],
        yAxisTicks: [0, 2, 4, 6, 8, 10],
        brushStartIndex: undefined,
        brushEndIndex: undefined,
      };
    }

    // 移動平均を計算
    const csValues = dataPoints.map(d => d.csPerMin);
    // Calculate moving average manually for number array
    const movingAvg: number[] = [];
    for (let i = 0; i < csValues.length; i++) {
      const start = Math.max(0, i - movingAverageWindow + 1);
      const window = csValues.slice(start, i + 1);
      const sum = window.reduce((acc, val) => acc + (isNaN(val) ? 0 : val), 0);
      const count = window.filter(val => !isNaN(val)).length;
      movingAvg.push(count > 0 ? sum / count : NaN);
    }
    movingAvg.forEach((avg, index) => {
      if (dataPoints[index]) {
        dataPoints[index].movingAverage = avg;
      }
    });

    // Y軸の範囲を計算
    const allValues = [...csValues, ...movingAvg.filter(v => !isNaN(v))];
    const minValue = Math.max(0, Math.min(...allValues) - 1);
    const maxValue = Math.max(...allValues) + 1;
    
    // Y軸のティックを生成
    const range = maxValue - minValue;
    const tickCount = 6;
    const tickStep = range / (tickCount - 1);
    const ticks: number[] = [];
    for (let i = 0; i < tickCount; i++) {
      ticks.push(Math.round((minValue + tickStep * i) * 10) / 10);
    }

    // Calculate brush start/end indices based on timeRange (same logic as LP chart)
    let brushStart: number | undefined = undefined;
    let brushEnd: number | undefined = undefined;
    
    if (timeRange !== 'all' && dataPoints.length > 0) {
      const now = new Date().getTime();
      let targetStartDate: number;
      
      switch (timeRange) {
        case '5years':
          targetStartDate = new Date(now).setFullYear(new Date(now).getFullYear() - 5);
          break;
        case '1year':
          targetStartDate = new Date(now).setFullYear(new Date(now).getFullYear() - 1);
          break;
        case '1month':
          targetStartDate = new Date(now).setMonth(new Date(now).getMonth() - 1);
          break;
        case '1week':
          targetStartDate = now - 7 * 24 * 60 * 60 * 1000;
          break;
        default:
          targetStartDate = now;
      }
      
      let startIdx = dataPoints.findIndex(d => d.dateValue >= targetStartDate);
      if (startIdx === -1) {
        startIdx = 0;
      }
      
      // 今日の日付を取得（時刻を0時にリセット）
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTime = today.getTime();
      
      // 今日に最も近いデータポイントのインデックスを見つける
      let todayIdx = dataPoints.length - 1;
      for (let i = dataPoints.length - 1; i >= 0; i--) {
        if (dataPoints[i].dateValue <= todayTime) {
          todayIdx = i;
          break;
        }
      }
      
      // 今日が右端の90%の位置に来るように調整
      const targetTodayPosition = 0.9; // 90%の位置
      const totalVisiblePoints = Math.max(10, Math.floor((todayIdx - startIdx) / targetTodayPosition));
      
      brushStart = Math.max(startIdx, todayIdx - totalVisiblePoints + 1);
      brushEnd = Math.min(dataPoints.length - 1, todayIdx + Math.floor(totalVisiblePoints * 0.1));
      
      // 最小表示ポイント数を確保
      if (brushEnd - brushStart < 2 && dataPoints.length > 0) {
        const minVisiblePoints = Math.max(2, Math.floor(dataPoints.length * 0.1));
        brushStart = Math.max(0, dataPoints.length - minVisiblePoints);
        brushEnd = dataPoints.length - 1;
      }
    } else if (dataPoints.length > 10) {
      // For 'all' timeRange, use 80% of data
      brushStart = Math.floor(dataPoints.length * 0.1);
      brushEnd = Math.floor(dataPoints.length * 0.9);
    }

    return {
      data: dataPoints,
      yAxisDomain: [minValue, maxValue],
      yAxisTicks: ticks,
      brushStartIndex: brushStart,
      brushEndIndex: brushEnd,
    };
  }, [matches, timeRange, movingAverageWindow]);
}

