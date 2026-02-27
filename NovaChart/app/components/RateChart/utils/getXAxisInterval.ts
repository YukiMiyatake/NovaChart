import { TimeRange } from './timeRange';

interface ChartDataWithBrush {
  data: any[];
  brushStartIndex?: number;
  brushEndIndex?: number;
}

export function getXAxisInterval(
  timeRange: TimeRange,
  chartData: ChartDataWithBrush,
  brushStartIndex: number | undefined,
  brushEndIndex: number | undefined
): number | 'preserveStartEnd' {
  const effectiveStartIndex = brushStartIndex ?? chartData.brushStartIndex ?? 0;
  const effectiveEndIndex = brushEndIndex ?? chartData.brushEndIndex ?? chartData.data.length - 1;
  const visibleDataPoints = Math.max(1, effectiveEndIndex - effectiveStartIndex + 1);
  
  switch (timeRange) {
    case '1week':
      // 1週間: すべて表示（interval=0）
      return 0;
    case '1month':
      // 1か月: データポイント数に応じて調整（最大30日分なので、interval=0または1）
      return visibleDataPoints > 30 ? 1 : 0;
    case '1year':
      // 1年: 2-3日おき
      return visibleDataPoints > 100 ? 2 : 1;
    case '5years':
      // 5年: 週ごと程度
      return visibleDataPoints > 200 ? 5 : 2;
    default:
      // all: 自動
      return 'preserveStartEnd';
  }
}

