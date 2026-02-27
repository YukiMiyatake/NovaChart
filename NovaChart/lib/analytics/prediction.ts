import { RateHistory } from '@/types';
import { tierRankToLP } from '@/lib/riot/client';

export interface LinearRegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
}

export interface PredictionResult {
  predictedLP: number;
  predictedDate: Date;
  confidence: number;
}

/**
 * Calculate linear regression from rate history data
 */
export function calculateLinearRegression(
  data: RateHistory[]
): LinearRegressionResult {
  if (data.length < 2) {
    return { slope: 0, intercept: 0, rSquared: 0 };
  }

  // Convert dates to numeric values (days since first date)
  const firstDate = new Date(data[0].date).getTime();
  const xValues = data.map((d) => (new Date(d.date).getTime() - firstDate) / (1000 * 60 * 60 * 24));
  const yValues = data.map((d) => tierRankToLP(d.tier, d.rank, d.lp));

  const n = data.length;
  const sumX = xValues.reduce((a, b) => a + b, 0);
  const sumY = yValues.reduce((a, b) => a + b, 0);
  const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
  const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);
  const sumYY = yValues.reduce((sum, y) => sum + y * y, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared
  const yMean = sumY / n;
  const ssRes = yValues.reduce((sum, y, i) => {
    const predicted = slope * xValues[i] + intercept;
    return sum + Math.pow(y - predicted, 2);
  }, 0);
  const ssTot = yValues.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { slope, intercept, rSquared };
}

/**
 * Predict when a target LP will be reached using linear regression
 */
export function predictReachDate(
  data: RateHistory[],
  targetLP: number
): PredictionResult | null {
  if (data.length < 2) {
    return null;
  }

  const regression = calculateLinearRegression(data);
  if (regression.slope <= 0) {
    return null; // Not improving or declining
  }

  const firstDate = new Date(data[0].date).getTime();
  const currentLP = tierRankToLP(
    data[data.length - 1].tier,
    data[data.length - 1].rank,
    data[data.length - 1].lp
  );

  // Calculate days needed: (targetLP - intercept) / slope - currentDay
  const currentDay = (new Date(data[data.length - 1].date).getTime() - firstDate) / (1000 * 60 * 60 * 24);
  const targetDay = (targetLP - regression.intercept) / regression.slope;
  const daysNeeded = targetDay - currentDay;

  if (daysNeeded < 0) {
    return null; // Target already passed or unreachable
  }

  const predictedDate = new Date(data[data.length - 1].date);
  predictedDate.setDate(predictedDate.getDate() + Math.ceil(daysNeeded));

  // Confidence based on R-squared and data points
  const confidence = Math.min(100, regression.rSquared * 100 * (1 + Math.min(data.length / 30, 0.3)));

  return {
    predictedLP: targetLP,
    predictedDate,
    confidence: Math.round(confidence),
  };
}

/**
 * Calculate moving average of LP over a window
 */
export function calculateMovingAverage(
  data: RateHistory[],
  windowSize: number = 7
): Array<{ date: Date; value: number }> {
  if (data.length === 0) {
    return [];
  }

  const result: Array<{ date: Date; value: number }> = [];
  const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  for (let i = 0; i < sortedData.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(sortedData.length, i + Math.ceil(windowSize / 2));
    const window = sortedData.slice(start, end);

    const avgLP = window.reduce((sum, d) => {
      return sum + tierRankToLP(d.tier, d.rank, d.lp);
    }, 0) / window.length;

    result.push({
      date: new Date(sortedData[i].date),
      value: avgLP,
    });
  }

  return result;
}

/**
 * Generate prediction points for visualization
 * Works for both upward and downward trends
 */
export function generatePredictionPoints(
  data: RateHistory[],
  daysAhead: number = 30
): Array<{ date: Date; predictedLP: number }> {
  if (data.length < 2) {
    return [];
  }

  const regression = calculateLinearRegression(data);
  // Allow predictions for both upward (slope > 0) and downward (slope < 0) trends
  // Only skip if slope is exactly 0 (no change)

  const firstDate = new Date(data[0].date).getTime();
  const lastDate = new Date(data[data.length - 1].date).getTime();
  const lastDay = (lastDate - firstDate) / (1000 * 60 * 60 * 24);

  const points: Array<{ date: Date; predictedLP: number }> = [];
  
  for (let i = 0; i <= daysAhead; i++) {
    const day = lastDay + i;
    const predictedLP = regression.slope * day + regression.intercept;
    const date = new Date(lastDate + i * 24 * 60 * 60 * 1000);
    
    points.push({ date, predictedLP });
  }

  return points;
}

