import { useMemo } from 'react';
import { Goal, RateHistory } from '@/types';
import { tierRankToLP } from '@/lib/riot/client';
import { calculateMovingAverage, generatePredictionPoints } from '@/lib/analytics/prediction';
import { formatDateShort } from '@/lib/utils/date';
import { logger } from '@/lib/utils/logger';

export interface ChartDataPoint {
  date: string;
  dateValue: number;
  lp: number;
  movingAverage?: number;
  predictedLP?: number;
  goalLP?: number;
  originalEntry?: RateHistory;
  [key: string]: any; // For dynamic goal line keys
}

export interface GoalDataItem {
  goal: Goal;
  goalLP: number;
  targetDate: number;
  startDate: number;
  startLP: number;
}

export interface ChartDataResult {
  data: ChartDataPoint[];
  yAxisDomain: [number, number];
  yAxisTicks: number[];
  xAxisDomain: [number, number];
  brushStartIndex: number | undefined;
  brushEndIndex: number | undefined;
  goalData: GoalDataItem[];
}

import { TimeRange } from './utils/timeRange';

export function useChartData(
  rateHistory: RateHistory[],
  goals: Goal[],
  timeRange: TimeRange,
  movingAverageWindow: number
): ChartDataResult {
  return useMemo(() => {
    if (rateHistory.length === 0) {
      return { 
        data: [], 
        yAxisDomain: [0, 2800], 
        yAxisTicks: [0, 400, 800, 1200, 1600, 2000, 2400, 2800],
        xAxisDomain: [0, Date.now()],
        brushStartIndex: undefined,
        brushEndIndex: undefined,
        goalData: [],
      };
    }

    // Sort by date (oldest first) - use ALL data
    const sorted = [...rateHistory].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    logger.debug('[RateChart] Processing rate history:', sorted.length, 'entries');

    // Group by date (same day) and keep only the last entry for each day
    const dateMap = new Map<string, RateHistory>();
    sorted.forEach((entry) => {
      const date = new Date(entry.date);
      const dateStr = formatDateShort(date);
      // Keep the last entry for each date (since sorted is already sorted by date)
      dateMap.set(dateStr, entry);
    });
    
    // Convert map values back to array (already sorted by date since we iterated sorted array)
    const filteredSorted = Array.from(dateMap.values());

    // Create data points with full date info for sorting
    const dataPoints: (ChartDataPoint & { dateTime: number; originalEntry: RateHistory })[] = filteredSorted.map((entry) => {
      const dateTime = new Date(entry.date).getTime();
      const totalLP = tierRankToLP(entry.tier, entry.rank, entry.lp);
      const date = new Date(entry.date);
      const dateStr = formatDateShort(date);
      return {
        date: dateStr,
        dateValue: dateTime,
        dateTime,
        lp: totalLP,
        originalEntry: entry,
      };
    });

    // Add moving average (use filtered data)
    const movingAvg = calculateMovingAverage(filteredSorted, movingAverageWindow);
    movingAvg.forEach((avg, index) => {
      if (dataPoints[index]) {
        dataPoints[index].movingAverage = avg.value;
      }
    });

    // Get the last data point and moving average value
    const lastDataPoint = dataPoints[dataPoints.length - 1];
    const lastLP = lastDataPoint?.lp ?? 0;
    const lastMovingAvg = lastDataPoint?.movingAverage ?? lastLP;
    const lastDate = lastDataPoint ? new Date(lastDataPoint.dateTime) : new Date();
    
    // Extend Total LP line to today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    const lastDateTime = lastDate.getTime();
    
    // Add today's point if last data point is not today
    if (lastDateTime < todayTime) {
      const todayDateStr = formatDateShort(today);
      
      dataPoints.push({
        date: todayDateStr,
        dateValue: todayTime,
        dateTime: todayTime,
        lp: lastLP,
        movingAverage: lastMovingAvg,
        originalEntry: lastDataPoint?.originalEntry,
      });
    }

    // Add prediction points (use filtered data)
    const predictions = generatePredictionPoints(filteredSorted, 30);
    const predictionPoints: (ChartDataPoint & { dateTime: number })[] = predictions.map((pred) => {
      const dateTime = new Date(pred.date).getTime();
      const date = new Date(pred.date);
      const dateStr = formatDateShort(date);
      return {
        date: dateStr,
        dateValue: dateTime,
        dateTime,
        lp: NaN,
        predictedLP: pred.predictedLP,
      };
    });

    // Add predictedLP to the last data point to connect prediction line
    if (predictionPoints.length > 0 && dataPoints.length > 0) {
      const lastDataPoint = dataPoints[dataPoints.length - 1];
      const firstPredictionPoint = predictionPoints[0];
      // Set predictedLP on the last data point if it doesn't already have it
      // This ensures the prediction line connects from the last actual data point
      if (lastDataPoint.predictedLP === undefined) {
        lastDataPoint.predictedLP = firstPredictionPoint.predictedLP;
      }
    }

    // Add goal lines for all goals
    const sortedGoals = (Array.isArray(goals) ? goals : []).sort((a, b) => 
      new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime()
    );
    
    const goalData: GoalDataItem[] = sortedGoals.map((goal, index) => {
      const goalLP = tierRankToLP(goal.targetTier, goal.targetRank, goal.targetLP);
      const targetDate = new Date(goal.targetDate).getTime();
      
      // Calculate start point
      let startDate: number;
      let startLP: number;
      
      if (index === 0) {
        const createdAt = new Date(goal.createdAt).getTime();
        startDate = createdAt;
        
        const entriesBeforeCreatedAt = filteredSorted.filter(e => new Date(e.date).getTime() <= createdAt);
        let closestEntry: RateHistory | undefined;
        
        if (entriesBeforeCreatedAt.length > 0) {
          closestEntry = entriesBeforeCreatedAt[entriesBeforeCreatedAt.length - 1];
        } else if (filteredSorted.length > 0) {
          closestEntry = filteredSorted[0];
        }
        
        if (closestEntry) {
          startLP = tierRankToLP(closestEntry.tier, closestEntry.rank, closestEntry.lp);
        } else {
          startLP = 0;
        }
      } else {
        const prevGoal = sortedGoals[index - 1];
        startDate = new Date(prevGoal.targetDate).getTime();
        startLP = tierRankToLP(prevGoal.targetTier, prevGoal.targetRank, prevGoal.targetLP);
      }
      
      return {
        goal,
        goalLP,
        targetDate,
        startDate,
        startLP,
      };
    });

    // Add goal line data points with linear interpolation for each day
    const goalLinePoints: (ChartDataPoint & { dateTime: number; goalIndex?: number; isTargetDate?: boolean })[] = [];
    goalData.forEach((goalItem, index) => {
      const startDate = new Date(goalItem.startDate);
      const endDate = new Date(goalItem.targetDate);
      
      // Set to start of day for consistent daily points
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);
      
      // Generate daily points from startDate to targetDate using linear interpolation
      const startTime = startDate.getTime();
      const endTime = endDate.getTime();
      const startLP = goalItem.startLP;
      const endLP = goalItem.goalLP;
      const totalDays = Math.ceil((endTime - startTime) / (24 * 60 * 60 * 1000));
      
      // Handle edge case: same day
      if (totalDays === 0) {
        const dateStr = formatDateShort(startDate);
      goalLinePoints.push({
          date: dateStr,
          dateValue: startTime,
          dateTime: startTime,
        lp: NaN,
          [`goalLineLP_${index}`]: endLP,
        goalIndex: index,
          isTargetDate: true,
      });
        return;
      }
      
      // Calculate daily points
      for (let day = 0; day <= totalDays; day++) {
        const currentTime = startTime + day * (24 * 60 * 60 * 1000);
        const currentDate = new Date(currentTime);
        const dateStr = formatDateShort(currentDate);
        
        // Linear interpolation: LP = startLP + (endLP - startLP) * (day / totalDays)
        const interpolatedLP = startLP + (endLP - startLP) * (day / totalDays);
        const isTargetDate = day === totalDays;
      
      goalLinePoints.push({
          date: dateStr,
          dateValue: currentTime,
          dateTime: currentTime,
        lp: NaN,
          [`goalLineLP_${index}`]: interpolatedLP,
        goalIndex: index,
          isTargetDate,
      });
      }
    });

    // Add goal date points
    const goalDatePoints: (ChartDataPoint & { dateTime: number })[] = goalData.map((goalItem) => {
      const goalDate = new Date(goalItem.targetDate);
      const dateStr = formatDateShort(goalDate);
      return {
        date: dateStr,
        dateValue: goalItem.targetDate,
        dateTime: goalItem.targetDate,
        lp: NaN,
      };
    });

    // Combine and sort by dateTime
    let combined = [...dataPoints, ...predictionPoints, ...goalDatePoints, ...goalLinePoints].sort((a, b) => a.dateTime - b.dateTime);
    
    // Merge points with the same dateTime to ensure prediction line connects properly
    const mergedMap = new Map<number, ChartDataPoint & { dateTime: number; originalEntry?: RateHistory; goalIndex?: number; isTargetDate?: boolean; [key: string]: any }>();
    combined.forEach(point => {
      const existing = mergedMap.get(point.dateTime);
      if (existing) {
        // Merge properties, prioritizing data point values over prediction values
        mergedMap.set(point.dateTime, {
          ...existing,
          ...point,
          // Keep lp from data point if it exists, otherwise use prediction point's lp
          lp: !isNaN(existing.lp) ? existing.lp : point.lp,
          // Merge predictedLP if it exists
          predictedLP: point.predictedLP !== undefined ? point.predictedLP : existing.predictedLP,
          // Merge movingAverage if it exists
          movingAverage: point.movingAverage !== undefined ? point.movingAverage : existing.movingAverage,
          // Keep originalEntry if it exists
          originalEntry: existing.originalEntry || point.originalEntry,
        });
      } else {
        mergedMap.set(point.dateTime, point);
      }
    });
    combined = Array.from(mergedMap.values()).sort((a, b) => a.dateTime - b.dateTime);
    
    // Extend moving average to display range end
    const lastDataPointWithMA = dataPoints.filter(d => d.movingAverage !== undefined).pop();
    if (lastDataPointWithMA && lastDataPointWithMA.movingAverage !== undefined) {
      const maxDateValue = Math.max(...combined.map(d => d.dateTime));
      const lastMAValue = lastDataPointWithMA.movingAverage;
      const lastMADate = lastDataPointWithMA.dateTime;
      
      if (maxDateValue > lastMADate) {
        const pointsNeedingMA = combined.filter(d => d.dateTime > lastMADate && d.dateTime <= maxDateValue);
        pointsNeedingMA.forEach(point => {
          point.movingAverage = lastMAValue;
        });
      }
    }
    
    // Remove dateTime before returning
    const finalData = combined.map(({ dateTime, originalEntry, ...rest }) => rest);
    
    // Calculate X-axis domain
    const now = Date.now();
    let xAxisDomain: [number, number];
    
    const latestGoalDate = goalData.length > 0 
      ? Math.max(...goalData.map(g => g.targetDate))
      : null;
    
    if (timeRange === 'all') {
      const minDate = finalData.length > 0 ? Math.min(...finalData.map(d => d.dateValue)) : now;
      const maxDate = finalData.length > 0 ? Math.max(...finalData.map(d => d.dateValue)) : now;
      const extendedMaxDate = latestGoalDate && latestGoalDate > maxDate ? latestGoalDate : maxDate;
      xAxisDomain = [minDate, extendedMaxDate];
    } else {
      let startDate: number;
      switch (timeRange) {
        case '5years':
          startDate = new Date(now).setFullYear(new Date(now).getFullYear() - 5);
          break;
        case '1year':
          startDate = new Date(now).setFullYear(new Date(now).getFullYear() - 1);
          break;
        case '1month':
          startDate = new Date(now).setMonth(new Date(now).getMonth() - 1);
          break;
        case '1week':
          startDate = now - 7 * 24 * 60 * 60 * 1000;
          break;
        default:
          startDate = now;
      }
      
      const dataMinDate = finalData.length > 0 ? Math.min(...finalData.map(d => d.dateValue)) : now;
      const dataMaxDate = finalData.length > 0 ? Math.max(...finalData.map(d => d.dateValue)) : now;
      
      const domainStart = Math.min(startDate, dataMinDate);
      let domainEnd = Math.max(now, dataMaxDate);
      if (latestGoalDate && latestGoalDate > domainEnd) {
        domainEnd = latestGoalDate;
      }
      
      xAxisDomain = [domainStart, domainEnd];
    }
    
    const yAxisDomain: [number, number] = [0, 2800];
    const yAxisTicks: number[] = [0, 400, 800, 1200, 1600, 2000, 2400, 2800];
    
    // Calculate brush start/end indices
    let brushStart: number | undefined = undefined;
    let brushEnd: number | undefined = undefined;
    
    if (timeRange !== 'all' && finalData.length > 0) {
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
      
      let startIdx = finalData.findIndex(d => d.dateValue >= targetStartDate);
      if (startIdx === -1) {
        startIdx = 0;
      }
      
      // 今日の日付を取得（時刻を0時にリセット）
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTime = today.getTime();
      
      // 今日に最も近いデータポイントのインデックスを見つける
      let todayIdx = finalData.length - 1;
      for (let i = finalData.length - 1; i >= 0; i--) {
        if (finalData[i].dateValue <= todayTime) {
          todayIdx = i;
          break;
        }
      }
      
      // 今日が右端の90%の位置に来るように調整
      // つまり、今日のインデックスが表示範囲の90%の位置に来るようにする
      const targetTodayPosition = 0.9; // 90%の位置
      const totalVisiblePoints = Math.max(10, Math.floor((todayIdx - startIdx) / targetTodayPosition));
      
      brushStart = Math.max(startIdx, todayIdx - totalVisiblePoints + 1);
      brushEnd = Math.min(finalData.length - 1, todayIdx + Math.floor(totalVisiblePoints * 0.1));
      
      // 最小表示ポイント数を確保
      if (brushEnd - brushStart < 2 && finalData.length > 0) {
        const minVisiblePoints = Math.max(2, Math.floor(finalData.length * 0.1));
        brushStart = Math.max(0, finalData.length - minVisiblePoints);
        brushEnd = finalData.length - 1;
      }
    }
    
    logger.debug('[RateChart] Final chart data points:', finalData.length);
    
    return { 
      data: finalData, 
      yAxisDomain, 
      yAxisTicks, 
      xAxisDomain,
      brushStartIndex: brushStart,
      brushEndIndex: brushEnd,
      goalData,
    };
  }, [rateHistory, goals, timeRange, movingAverageWindow]);
}

