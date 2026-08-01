"use client";

import { formatPercent } from "@/lib/utils";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const pieColors = ["#0f766e", "#14b8a6", "#f59e0b", "#f97316", "#475569", "#94a3b8"];

export function RevenueTrendChart({
  data,
}: {
  data: { month: string; revenue: number; profit: number }[];
}) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="revenueFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#0f766e" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#cbd5e1" opacity={0.25} />
          <XAxis dataKey="month" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} />
          <Tooltip />
          <Area type="monotone" dataKey="revenue" stroke="#0f766e" fill="url(#revenueFill)" strokeWidth={3} />
          <Area type="monotone" dataKey="profit" stroke="#f59e0b" fillOpacity={0} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RatioChart({ data }: { data: { metric: string; value: number }[] }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 12 }}>
          <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="#cbd5e1" opacity={0.2} />
          <XAxis type="number" tickLine={false} axisLine={false} />
          <YAxis dataKey="metric" type="category" tickLine={false} axisLine={false} width={88} />
          <Tooltip formatter={(value) => (typeof value === "number" ? formatPercent(value) : value ?? "")} />
          <Bar dataKey="value" radius={[0, 10, 10, 0]} fill="#0f766e" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AgeingChart({ data }: { data: { bucket: string; value: number }[] }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="bucket" innerRadius={60} outerRadius={96} paddingAngle={3}>
            {data.map((entry, index) => (
              <Cell key={entry.bucket} fill={pieColors[index % pieColors.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
