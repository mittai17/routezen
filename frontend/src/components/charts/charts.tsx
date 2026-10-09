"use client";
import * as React from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";

export const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)", "var(--chart-7)"];

export interface BarDatum { label: string; value: number | null; color?: string }

export function ChartCard({ title, icon, subtitle, children, className }: { title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader title={title} subtitle={subtitle} icon={icon} />
      <CardContent className="pt-2">{children}</CardContent>
    </Card>
  );
}

/** Bar chart wrapper. `null` values render as "N/A" (no bar) rather than zero. */
export function BarChartView({ data, unit, height = 190 }: { data: BarDatum[]; unit?: string; height?: number }) {
  if (data.length === 0) return <EmptyState title="No data" className="py-6" />;
  const rows = data.map((d, i) => ({ ...d, v: d.value ?? 0, fill: d.color ?? CHART_COLORS[i % CHART_COLORS.length] }));
  return (
    <div style={{ height }} role="img" aria-label={`Bar chart: ${data.map((d) => `${d.label} ${d.value ?? "N/A"}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height }}>
        <BarChart data={rows} margin={{ top: 18, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} interval={0} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", fontSize: 12 }} formatter={(v) => [`${v}${unit ? ` ${unit}` : ""}`, ""]} separator="" />
          <Bar dataKey="v" radius={[6, 6, 0, 0]} maxBarSize={34}>
            {rows.map((r) => <Cell key={r.label} fill={r.fill} />)}
            <LabelList dataKey="label" position="top" content={(p) => <text x={Number(p.x) + Number(p.width) / 2} y={Number(p.y) - 5} textAnchor="middle" fontSize={11} fill="var(--foreground)">{data[Number(p.index)]?.value ?? "N/A"}</text>} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LineChartView({ data, series, xKey, height = 220 }: { data: Record<string, number | string>[]; series: { key: string; label: string; color: string }[]; xKey: string; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height }}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12 }} />
          {series.map((s) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={{ r: 3 }} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
