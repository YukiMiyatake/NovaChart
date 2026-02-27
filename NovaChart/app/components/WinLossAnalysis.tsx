'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/lib/store/useAppStore';
import { analyzeWinLoss, analyzeWinLossByLane, calculateDifferencePercentage, getLaneName, ImprovementSuggestion } from '@/lib/analytics/winLossAnalysis';

export default function WinLossAnalysis() {
  const { matches } = useAppStore();

  const laneAnalyses = useMemo(() => {
    return analyzeWinLossByLane(matches);
  }, [matches]);

  const validLaneAnalyses = laneAnalyses.filter(la => la.analysis !== null);

  if (validLaneAnalyses.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">勝敗分析</h2>
        <p className="text-gray-500">
          {matches.length === 0
            ? '試合データがありません'
            : 'レーン別の試合データが不足しています'}
        </p>
      </div>
    );
  }

  const getPriorityColor = (priority: ImprovementSuggestion['priority']) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
      case 'medium':
        return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
      case 'low':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200';
    }
  };

  const getPriorityLabel = (priority: ImprovementSuggestion['priority']) => {
    switch (priority) {
      case 'high':
        return '高';
      case 'medium':
        return '中';
      case 'low':
        return '低';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4">勝敗分析（レーン別）</h2>

      <div className="space-y-6">
        {validLaneAnalyses.map(({ lane, analysis }) => {
          if (!analysis) return null;

          return (
            <div key={lane} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h3 className="text-xl font-semibold mb-4">{getLaneName(lane)}</h3>

              {/* 試合数サマリー */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 bg-green-50 dark:bg-green-900 rounded">
                  <p className="text-xs text-gray-600 dark:text-gray-400">勝利試合</p>
                  <p className="text-2xl font-bold">{analysis.wins.count}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    勝率: {Math.round((analysis.wins.count / (analysis.wins.count + analysis.losses.count)) * 100)}%
                  </p>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-900 rounded">
                  <p className="text-xs text-gray-600 dark:text-gray-400">敗北試合</p>
                  <p className="text-2xl font-bold">{analysis.losses.count}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    敗率: {Math.round((analysis.losses.count / (analysis.wins.count + analysis.losses.count)) * 100)}%
                  </p>
                </div>
              </div>

              {/* 改善提案 */}
              {analysis.improvementSuggestions.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold mb-3">改善提案</h4>
                  <div className="space-y-2">
                    {analysis.improvementSuggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border-l-4 ${
                          suggestion.priority === 'high'
                            ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                            : suggestion.priority === 'medium'
                            ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                            : 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getPriorityColor(suggestion.priority)}`}>
                                {getPriorityLabel(suggestion.priority)}優先度
                              </span>
                              <span className="font-semibold text-sm">{suggestion.category}</span>
                              <span className="text-gray-600 dark:text-gray-400 text-sm">-</span>
                              <span className="text-gray-600 dark:text-gray-400 text-sm">{suggestion.metric}</span>
                            </div>
                            <p className="text-xs text-gray-700 dark:text-gray-300">{suggestion.description}</p>
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                          現在: {typeof suggestion.currentValue === 'number' && suggestion.currentValue % 1 !== 0
                            ? suggestion.currentValue.toFixed(1)
                            : suggestion.currentValue.toLocaleString()} → 目標: {typeof suggestion.targetValue === 'number' && suggestion.targetValue % 1 !== 0
                            ? suggestion.targetValue.toFixed(1)
                            : suggestion.targetValue.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysis.improvementSuggestions.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-2">
                  このレーンでは改善提案がありません
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ComparisonBarProps {
  label: string;
  winValue: number;
  lossValue: number;
  difference: number;
  formatValue: (value: number) => string;
  reverse?: boolean; // trueの場合、値が小さい方が良い（例: デス数）
}

function ComparisonBar({ label, winValue, lossValue, difference, formatValue, reverse = false }: ComparisonBarProps) {
  const maxValue = Math.max(winValue, lossValue);
  const winPercentage = maxValue > 0 ? (winValue / maxValue) * 100 : 0;
  const lossPercentage = maxValue > 0 ? (lossValue / maxValue) * 100 : 0;
  const isPositive = reverse ? difference < 0 : difference > 0;
  const diffPercentage = calculateDifferencePercentage(winValue, lossValue);

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span
          className={`text-sm font-semibold ${
            isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}
        >
          {isPositive ? '+' : ''}
          {formatValue(difference)} ({diffPercentage > 0 ? '+' : ''}
          {diffPercentage}%)
        </span>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-green-600 dark:text-green-400">勝利</span>
            <span className="text-gray-600 dark:text-gray-400">{formatValue(winValue)}</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
            <div
              className="bg-green-500 h-4 rounded-full"
              style={{ width: `${winPercentage}%` }}
            />
          </div>
        </div>
        <div className="flex-1">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-red-600 dark:text-red-400">敗北</span>
            <span className="text-gray-600 dark:text-gray-400">{formatValue(lossValue)}</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
            <div
              className="bg-red-500 h-4 rounded-full"
              style={{ width: `${lossPercentage}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

