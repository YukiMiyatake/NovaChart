'use client';

import { YAxisZoom } from './useYAxisConfig';
import { TimeRange } from './utils/timeRange';

interface ChartControlsProps {
  timeRange: TimeRange;
  movingAverageWindow: number;
  yAxisZoom: YAxisZoom | null;
  onTimeRangeChange: (range: TimeRange) => void;
  onMovingAverageWindowChange: (window: number) => void;
  onYAxisZoomReset: () => void;
}

export default function ChartControls({
  timeRange,
  movingAverageWindow,
  yAxisZoom,
  onTimeRangeChange,
  onMovingAverageWindowChange,
  onYAxisZoomReset,
}: ChartControlsProps) {
  return (
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-2xl font-bold"></h2>
      <div className="flex gap-2">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700 dark:text-gray-300">移動平均:</label>
          <input
            type="number"
            min="1"
            max="30"
            value={movingAverageWindow}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10);
              if (!isNaN(value) && value >= 1 && value <= 30) {
                onMovingAverageWindowChange(value);
              }
            }}
            className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">日</span>
        </div>
        <button
          onClick={onYAxisZoomReset}
          disabled={!yAxisZoom}
          className="px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          title="Y軸のズームをリセット"
        >
          Y軸リセット
        </button>
        <select
          value={timeRange}
          onChange={(e) => {
            onTimeRangeChange(e.target.value as TimeRange);
            onYAxisZoomReset();
          }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">無限</option>
          <option value="5years">5年</option>
          <option value="1year">1年</option>
          <option value="1month">1か月</option>
          <option value="1week">1週間</option>
        </select>
      </div>
    </div>
  );
}

