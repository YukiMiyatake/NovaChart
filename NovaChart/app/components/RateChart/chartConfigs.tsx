import React from 'react';
import { lpToTierRank } from '@/lib/riot/client';
import { ChartDataResult } from './useChartData';
import { LPTooltip } from './LPTooltip';

export interface LineConfig {
  dataKey: string;
  stroke: string;
  strokeWidth: number;
  name: string | ((movingAverageWindow: number) => string);
  dot?: { r: number } | false | ((props: any) => React.ReactElement);
  connectNulls: boolean;
  strokeDasharray?: string;
  isAnimationActive?: boolean;
  activeDot?: { r: number };
  type?: 'monotone' | 'linear';
  hide?: boolean;
}

export interface ChartConfig {
  yAxisFormatter: (value: number) => string;
  yAxisLabel?: { value: string; angle: number; position: string };
  yAxisAllowDecimals: boolean;
  tooltipFormatter: (value: number, name: string, props: any) => string | number;
  tooltipContent?: React.ComponentType<any>;
  baseLines: (movingAverageWindow: number, hiddenLines: Set<string>) => LineConfig[];
  goalLines?: (chartData: ChartDataResult, movingAverageWindow: number, hiddenLines: Set<string>) => LineConfig[];
  brushColor: string;
  brushFillColor: string;
  brushStrokeColor: string;
  brushTravellerFill: string;
  brushTravellerStroke: string;
}

export const lpChartConfig: ChartConfig = {
  yAxisFormatter: (value: number) => {
    if (isNaN(value) || value === undefined || value === null) return '';
    const tierRank = lpToTierRank(value);
    
    if (!tierRank || !tierRank.tier) return '';
    
    if (tierRank.tier === 'MASTER' || tierRank.tier === 'GRANDMASTER' || tierRank.tier === 'CHALLENGER') {
      return tierRank.tier;
    }
    
    const tierNames: Record<string, string> = {
      'IRON': 'Iron',
      'BRONZE': 'Bronze',
      'SILVER': 'Silver',
      'GOLD': 'Gold',
      'PLATINUM': 'Platinum',
      'EMERALD': 'Emerald',
      'DIAMOND': 'Diamond',
    };
    
    const tierName = tierNames[tierRank.tier] || tierRank.tier;
    
    const rankNumbers: Record<string, string> = {
      'IV': '4',
      'III': '3',
      'II': '2',
      'I': '1',
    };
    
    const rankNumber = tierRank.rank ? (rankNumbers[tierRank.rank] || '') : '';
    
    if (rankNumber && tierRank.lp < 5) {
      return `${tierName} ${rankNumber}`;
    }
    
    return '';
  },
  yAxisLabel: undefined,
  yAxisAllowDecimals: false,
  tooltipFormatter: (value: number, name: string, props: any) => {
    if (isNaN(value)) return 'N/A';
    if (name === 'Total LP' && props.payload.originalEntry) {
      const entry = props.payload.originalEntry;
      return `${entry.tier} ${entry.rank} ${entry.lp}LP (Total LP: ${Math.round(value)})`;
    }
    return Math.round(value);
  },
  tooltipContent: LPTooltip,
  baseLines: (movingAverageWindow: number, hiddenLines: Set<string>) => [
    {
      dataKey: 'lp',
      stroke: '#3b82f6',
      strokeWidth: 2,
      name: 'Total LP',
      dot: { r: 4 },
      connectNulls: true,
    },
    {
      dataKey: 'movingAverage',
      stroke: '#10b981',
      strokeWidth: 2,
      strokeDasharray: '5 5',
      name: `移動平均 (${movingAverageWindow}日)`,
      dot: false as const,
      connectNulls: true,
    },
    {
      dataKey: 'predictedLP',
      stroke: '#f59e0b',
      strokeWidth: 2,
      strokeDasharray: '3 3',
      name: '予測',
      dot: false as const,
      connectNulls: true,
    },
  ].map(line => ({ ...line, hide: hiddenLines.has(line.dataKey) })),
  goalLines: (chartData: ChartDataResult, movingAverageWindow: number, hiddenLines: Set<string>) => {
    if (!Array.isArray(chartData.goalData)) return [];
    return chartData.goalData.map((goalItem, index) => {
      const goalDataKey = `goalLineLP_${index}`;
      return {
        dataKey: goalDataKey,
        stroke: '#ef4444',
        strokeWidth: 2,
        strokeDasharray: '10 5',
        name: `目標${index + 1}: ${goalItem.goal.targetTier} ${goalItem.goal.targetRank} ${goalItem.goal.targetLP}LP`,
        dot: (props: any) => {
          if (props.payload?.isTargetDate) {
            return <circle cx={props.cx} cy={props.cy} r={4} fill="#ef4444" />;
          }
          return <g />;
        },
        activeDot: { r: 6 },
        connectNulls: true,
        isAnimationActive: false,
        type: 'linear' as const,
        hide: hiddenLines.has(goalDataKey),
      };
    });
  },
  brushColor: '#3b82f6',
  brushFillColor: '#3b82f6',
  brushStrokeColor: '#3b82f6',
  brushTravellerFill: '#1e40af',
  brushTravellerStroke: '#1e3a8a',
};

export const csChartConfig: ChartConfig = {
  yAxisFormatter: (value: number) => {
    if (isNaN(value)) return '';
    return value.toFixed(1);
  },
  yAxisLabel: { value: 'CS/分', angle: -90, position: 'insideLeft' },
  yAxisAllowDecimals: true,
  tooltipFormatter: (value: number, name: string) => {
    if (isNaN(value)) return 'N/A';
    return value.toFixed(1);
  },
  baseLines: (movingAverageWindow: number, hiddenLines: Set<string>) => [
    {
      dataKey: 'csPerMin',
      stroke: '#3b82f6',
      strokeWidth: 2,
      name: 'CS/分',
      dot: { r: 4 },
      connectNulls: true,
    },
    {
      dataKey: 'movingAverage',
      stroke: '#10b981',
      strokeWidth: 2,
      strokeDasharray: '5 5',
      name: `移動平均 (${movingAverageWindow}試合)`,
      dot: false as const,
      connectNulls: true,
    },
  ].map(line => ({ ...line, hide: hiddenLines.has(line.dataKey) })),
  brushColor: '#3b82f6',
  brushFillColor: '#3b82f6',
  brushStrokeColor: '#3b82f6',
  brushTravellerFill: '#1e40af',
  brushTravellerStroke: '#1e3a8a',
};

export const damageChartConfig: ChartConfig = {
  yAxisFormatter: (value: number) => {
    if (isNaN(value)) return '';
    return value.toLocaleString();
  },
  yAxisLabel: { value: 'ダメージ/分', angle: -90, position: 'insideLeft' },
  yAxisAllowDecimals: false,
  tooltipFormatter: (value: number, name: string) => {
    if (isNaN(value)) return 'N/A';
    return value.toLocaleString();
  },
  baseLines: (movingAverageWindow: number, hiddenLines: Set<string>) => [
    {
      dataKey: 'damagePerMin',
      stroke: '#ef4444',
      strokeWidth: 2,
      name: 'ダメージ/分',
      dot: { r: 4 },
      connectNulls: true,
    },
    {
      dataKey: 'movingAverage',
      stroke: '#10b981',
      strokeWidth: 2,
      strokeDasharray: '5 5',
      name: `移動平均 (${movingAverageWindow}試合)`,
      dot: false as const,
      connectNulls: true,
    },
  ].map(line => ({ ...line, hide: hiddenLines.has(line.dataKey) })),
  brushColor: '#ef4444',
  brushFillColor: '#ef4444',
  brushStrokeColor: '#ef4444',
  brushTravellerFill: '#991b1b',
  brushTravellerStroke: '#7f1d1d',
};

