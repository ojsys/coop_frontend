import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { naira, num } from '@/lib/format'

const AXIS = { fontSize: 11, fill: '#8a8478', fontFamily: 'IBM Plex Mono' }

type ValueFormat = 'naira' | 'count'
const fmt = (f: ValueFormat) =>
  f === 'count' ? (v: number) => num(v) : (v: number) => naira(v, { compact: true })
const fmtFull = (f: ValueFormat) =>
  f === 'count' ? (v: number) => num(v) : (v: number) => naira(v)

function tooltipStyle() {
  return {
    contentStyle: {
      borderRadius: 10,
      border: '1px solid #ece7db',
      background: '#fffdf9',
      fontSize: 12,
      boxShadow: '0 8px 24px -12px rgba(27,26,23,.2)',
    },
    labelStyle: { color: '#6f6b62', fontWeight: 600 },
  }
}

export function TrendArea({
  data,
  xKey,
  yKey,
  height = 200,
  format = 'naira',
}: {
  data: Record<string, unknown>[]
  xKey: string
  yKey: string
  height?: number
  format?: ValueFormat
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="g-green" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1f8a5b" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#1f8a5b" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#ece7db" />
        <XAxis dataKey={xKey} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          width={48}
          tickFormatter={fmt(format)}
        />
        <Tooltip {...tooltipStyle()} formatter={(v) => fmtFull(format)(Number(v))} />
        <Area
          type="monotone"
          dataKey={yKey}
          stroke="#0b4f3a"
          strokeWidth={2.5}
          fill="url(#g-green)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/** Tiny inline SVG sparkline for compact trend indicators (no axes/tooltip). */
export function Sparkline({
  values,
  width = 120,
  height = 32,
  color = '#0b4f3a',
}: {
  values: number[]
  width?: number
  height?: number
  color?: string
}) {
  if (values.length < 2) {
    return <div style={{ width, height }} className="rounded bg-sand-deep/40" />
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const step = width / (values.length - 1)
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / span) * (height - 4) - 2).toFixed(1)}`)
    .join(' ')
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle
        cx={(values.length - 1) * step}
        cy={height - ((values[values.length - 1] - min) / span) * (height - 4) - 2}
        r={2.5}
        fill={color}
      />
    </svg>
  )
}

export function BarSeries({
  data,
  xKey,
  yKey,
  height = 200,
  color = '#0b4f3a',
  highlightLast = false,
  format = 'naira',
}: {
  data: Record<string, unknown>[]
  xKey: string
  yKey: string
  height?: number
  color?: string
  highlightLast?: boolean
  format?: ValueFormat
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#ece7db" />
        <XAxis dataKey={xKey} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          width={48}
          tickFormatter={fmt(format)}
        />
        <Tooltip {...tooltipStyle()} cursor={{ fill: '#f1ece1' }} formatter={(v) => fmtFull(format)(Number(v))} />
        <Bar dataKey={yKey} radius={[6, 6, 0, 0]} maxBarSize={38}>
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={highlightLast && i === data.length - 1 ? '#d99e2b' : color}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
