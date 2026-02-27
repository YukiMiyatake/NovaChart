import React from 'react';
import { lpToTierRank } from '@/lib/riot/client';

interface LPTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: any;
  }>;
  label?: string;
}

export const LPTooltip: React.FC<LPTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  // Get originalEntry from the first payload entry (all entries share the same data point)
  const dataPoint = payload[0]?.payload;
  const originalEntry = dataPoint?.originalEntry;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-3">
      <p className="font-semibold mb-2 text-gray-900 dark:text-gray-100">
        {label ? `日付: ${label}` : ''}
      </p>
      {payload.map((entry, index) => {
        const value = entry.value;
        const name = entry.name;

        // For Total LP, show value and tier/rank below
        if (name === 'Total LP') {
          // Use originalEntry if available, otherwise calculate from Total LP value
          let tier = '';
          let rank = '';
          let lp = 0;
          
          if (originalEntry) {
            tier = originalEntry.tier || '';
            rank = originalEntry.rank || '';
            lp = originalEntry.lp ?? 0;
          } else if (!isNaN(value)) {
            // Calculate tier/rank from Total LP value
            const tierRank = lpToTierRank(value);
            tier = tierRank.tier || '';
            rank = tierRank.rank || '';
            lp = tierRank.lp ?? 0;
          }
          
          // Format tier name
          const tierNames: Record<string, string> = {
            'IRON': 'Iron',
            'BRONZE': 'Bronze',
            'SILVER': 'Silver',
            'GOLD': 'Gold',
            'PLATINUM': 'Platinum',
            'EMERALD': 'Emerald',
            'DIAMOND': 'Diamond',
            'MASTER': 'Master',
            'GRANDMASTER': 'Grandmaster',
            'CHALLENGER': 'Challenger',
          };
          
          const tierName = tierNames[tier] || tier;
          const rankDisplay = rank ? ` ${rank}` : '';
          
          return (
            <div key={index} className="mb-1">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <span style={{ color: entry.color || '#3b82f6' }}>
                  {name}: {Math.round(value)}
                </span>
              </p>
              {tier && (
                <p className="text-xs text-gray-600 dark:text-gray-400 ml-2">
                  {tierName}{rankDisplay} {lp}LP
                </p>
              )}
            </div>
          );
        }

        // For other entries (moving average, predicted, goals)
        if (isNaN(value)) {
          return (
            <div key={index} className="mb-1">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <span style={{ color: entry.color }}>
                  {name}: N/A
                </span>
              </p>
            </div>
          );
        }

        return (
          <div key={index} className="mb-1">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <span style={{ color: entry.color }}>
                {name}: {Math.round(value)}
              </span>
            </p>
          </div>
        );
      })}
    </div>
  );
};
