"use client";

import { useState } from "react";

const money = (c: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(c / 100);
const compact = (c: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(c / 100);

/** Nice round axis maximum and 4 ticks. */
function niceScale(max: number) {
  if (max <= 0) return { top: 100, ticks: [0, 25, 50, 75, 100] };
  const raw = max / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
  const top = step * 4;
  return { top, ticks: [0, step, step * 2, step * 3, top] };
}

export type MonthPoint = { label: string; billed: number; collected: number };

/**
 * Grouped bar chart: billed (series 1, blue) vs collected (series 2, orange) per month.
 * Single y-axis, recessive grid, legend, hover tooltip, and an equivalent table for screen readers.
 */
export function BillingChart({ data }: { data: MonthPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 240, padL = 52, padR = 8, padT = 12, padB = 28;
  const max = Math.max(...data.flatMap((d) => [d.billed, d.collected]), 0);
  const { top, ticks } = niceScale(max);
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const groupW = plotW / data.length;
  const barW = Math.min(22, (groupW - 18) / 2);
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const series = [
    { key: "billed" as const, label: "Billed", color: "var(--s1)" },
    { key: "collected" as const, label: "Collected", color: "var(--s2)" },
  ];

  return (
    <div className="relative" style={{ ["--s1" as string]: "#2a78d6", ["--s2" as string]: "#eb6834" }}>
      <div className="mb-3 flex items-center gap-4 text-xs text-slate-600">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Billed versus collected by month">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeDasharray={t === 0 ? undefined : "3 4"} />
            <text x={padL - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="#64748b">{compact(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const gx = padL + i * groupW;
          const cx = gx + groupW / 2;
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {/* Hit target: whole column, larger than the marks */}
              <rect x={gx} y={padT} width={groupW} height={plotH} fill={hover === i ? "#f1f5f9" : "transparent"} />
              {series.map((s, si) => {
                const v = d[s.key];
                const h = Math.max(0, y(0) - y(v));
                const x = cx - barW - 1 + si * (barW + 2); // 2px surface gap between bars
                const r = Math.min(4, h);
                return h > 0 ? (
                  <path
                    key={s.key}
                    d={`M${x},${y(0)} V${y(v) + r} Q${x},${y(v)} ${x + r},${y(v)} H${x + barW - r} Q${x + barW},${y(v)} ${x + barW},${y(v) + r} V${y(0)} Z`}
                    fill={s.color}
                  />
                ) : null;
              })}
              <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill="#64748b">{d.label}</text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-8 z-10 min-w-40 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: `${((padL + (hover + 0.5) * groupW) / W) * 100}%` }}
        >
          <p className="mb-1 font-semibold text-slate-900">{data[hover].label}</p>
          {series.map((s) => (
            <p key={s.key} className="flex items-center justify-between gap-4 text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="font-medium tabular-nums text-slate-900">{money(data[hover][s.key])}</span>
            </p>
          ))}
        </div>
      )}
      <table className="sr-only">
        <caption>Billed and collected by month</caption>
        <thead><tr><th>Month</th><th>Billed</th><th>Collected</th></tr></thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}><td>{d.label}</td><td>{money(d.billed)}</td><td>{money(d.collected)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Horizontal single-series bars (one hue) with direct value labels — used for receivables aging. */
export function BarList({ rows }: { rows: { label: string; value: number; emphasis?: boolean }[] }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex items-baseline justify-between text-[13px]">
            <span className="text-slate-600">{r.label}</span>
            <span className={`font-semibold tabular-nums ${r.emphasis && r.value ? "text-red-600" : "text-slate-900"}`}>{money(r.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: "#2a78d6", minWidth: r.value ? 4 : 0 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
