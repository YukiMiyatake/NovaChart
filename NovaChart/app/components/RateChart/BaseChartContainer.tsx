'use client';

import { useRef, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
} from 'recharts';
import { YAxisConfig, YAxisZoom } from './useYAxisConfig';
import { TimeRange } from './utils/timeRange';
import { getXAxisInterval } from './utils/getXAxisInterval';
import { ChartConfig, LineConfig } from './chartConfigs';
import { ChartDataResult } from './useChartData';
import { CSChartDataResult } from './useCSChartData';
import { DamageChartDataResult } from './useDamageChartData';

type ChartData = ChartDataResult | CSChartDataResult | DamageChartDataResult;

interface BaseChartContainerProps {
  chartData: ChartData;
  yAxisConfig: YAxisConfig;
  movingAverageWindow: number;
  brushStartIndex: number | undefined;
  brushEndIndex: number | undefined;
  hiddenLines: Set<string>;
  yAxisZoom: YAxisZoom | null;
  timeRange: TimeRange;
  onBrushChange: (startIndex: number, endIndex: number) => void;
  onLegendClick: (dataKey: string) => void;
  onYAxisZoom: (zoomIn: boolean) => void;
  chartConfig: ChartConfig;
}

export default function BaseChartContainer({
  chartData,
  yAxisConfig,
  movingAverageWindow,
  brushStartIndex,
  brushEndIndex,
  hiddenLines,
  yAxisZoom,
  timeRange,
  onBrushChange,
  onLegendClick,
  onYAxisZoom,
  chartConfig,
}: BaseChartContainerProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Handle mouse wheel on chart container
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      const delta = e.deltaY;
      const zoomIn = delta < 0;
      onYAxisZoom(zoomIn);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [onYAxisZoom]);

  const xAxisInterval = getXAxisInterval(timeRange, chartData, brushStartIndex, brushEndIndex);
  
  // Get base lines
  const baseLines = chartConfig.baseLines(movingAverageWindow, hiddenLines);
  
  // Get goal lines if available (only for LP chart)
  const goalLines = chartConfig.goalLines 
    ? chartConfig.goalLines(chartData as ChartDataResult, movingAverageWindow, hiddenLines)
    : [];

  const allLines = [...baseLines, ...goalLines];

  return (
    <div ref={chartContainerRef} className="w-full">
      <ResponsiveContainer width="100%" height={600}>
        <LineChart data={chartData.data} margin={{ top: 5, right: 30, left: 80, bottom: 100 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date"
            type="category"
            allowDuplicatedCategory={false}
            angle={-45}
            textAnchor="end"
            height={80}
            interval={xAxisInterval}
          />
          <YAxis 
            domain={yAxisConfig.yAxisDomain}
            ticks={yAxisConfig.yAxisTicks}
            tickFormatter={chartConfig.yAxisFormatter}
            width={90}
            allowDecimals={chartConfig.yAxisAllowDecimals}
            label={chartConfig.yAxisLabel}
          />
          <Tooltip
            content={chartConfig.tooltipContent || undefined}
            formatter={chartConfig.tooltipContent ? undefined : chartConfig.tooltipFormatter}
            labelFormatter={chartConfig.tooltipContent ? undefined : (label) => `日付: ${label}`}
          />
          <Legend onClick={(e: any) => onLegendClick(e.dataKey)} />
          {allLines.map((lineConfig: LineConfig, index: number) => (
            <Line
              key={lineConfig.dataKey || index}
              type={lineConfig.type || 'monotone'}
              dataKey={lineConfig.dataKey}
              stroke={lineConfig.stroke}
              strokeWidth={lineConfig.strokeWidth}
              strokeDasharray={lineConfig.strokeDasharray}
              name={typeof lineConfig.name === 'function' 
                ? lineConfig.name(movingAverageWindow) 
                : lineConfig.name}
              dot={lineConfig.dot}
              activeDot={lineConfig.activeDot}
              connectNulls={lineConfig.connectNulls}
              isAnimationActive={lineConfig.isAnimationActive}
              hide={lineConfig.hide || false}
            />
          ))}
          <Brush
            dataKey="date"
            height={30}
            stroke={chartConfig.brushColor}
            fill={chartConfig.brushFillColor}
            fillOpacity={0.3}
            strokeWidth={2}
            travellerWidth={12}
            startIndex={brushStartIndex ?? chartData.brushStartIndex}
            endIndex={brushEndIndex ?? chartData.brushEndIndex}
            onChange={(brushData: any) => {
              if (brushData && typeof brushData.startIndex === 'number' && typeof brushData.endIndex === 'number') {
                onBrushChange(brushData.startIndex, brushData.endIndex);
              }
            }}
            traveller={(props: any) => {
              const { x, y, width, height } = props;
              return (
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  fill={chartConfig.brushTravellerFill}
                  stroke={chartConfig.brushTravellerStroke}
                  strokeWidth={2}
                  rx={2}
                />
              );
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

