import React from 'react';
import { SparkRoot } from './Sparkline.styled';

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  /** Override line/fill color. Defaults to trend-based (up=critical, down=ok). */
  accent?: string;
  fill?: boolean;
}

export function Sparkline({
  data,
  width = 100,
  height = 26,
  accent,
  fill = true,
}: SparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = Math.max(1, max - min);

  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * (width - 2) + 1,
    height - 2 - ((v - min) / span) * (height - 4),
  ] as [number, number]);

  const last = data[data.length - 1] ?? 0;
  const first = data[0] ?? 0;
  const dir = last > first ? 'up' : last < first ? 'down' : 'flat';
  const color =
    accent ??
    (dir === 'up'
      ? 'var(--critical)'
      : dir === 'down'
        ? 'var(--ok)'
        : 'var(--fg-faint)');

  const linePath = pts
    .map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`))
    .join(' ');

  const lastPt = pts[pts.length - 1];
  const firstPt = pts[0];

  const areaPath =
    fill && lastPt && firstPt
      ? `${linePath} L${lastPt[0]},${height} L${firstPt[0]},${height} Z`
      : '';

  const dot = lastPt;

  return (
    <SparkRoot
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      {fill && areaPath && (
        <path d={areaPath} fill={color} opacity={0.15} />
      )}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {dot && (
        <circle cx={dot[0]} cy={dot[1]} r={1.8} fill={color} />
      )}
    </SparkRoot>
  );
}
