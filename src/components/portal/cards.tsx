import { cn } from "@/lib/utils";
import type { MetricCard } from "@/lib/types";

function isMonetaryMetric(metric: MetricCard) {
  return metric.value.includes("₹") || ["Total assets", "Revenue from operations", "Profit after tax"].includes(metric.label);
}

function getMetricValueClass(metric: MetricCard) {
  if (isMonetaryMetric(metric)) {
    return "text-[1.55rem] md:text-[1.7rem]";
  }

  const value = metric.value;
  const compactValue = value.replace(/\s+/g, "");

  if (compactValue.length >= 22) {
    return "text-[1.65rem] md:text-[1.8rem]";
  }

  if (compactValue.length >= 18) {
    return "text-[1.8rem] md:text-[1.95rem]";
  }

  if (compactValue.length >= 14) {
    return "text-[2rem] md:text-[2.15rem]";
  }

  if (compactValue.length >= 10) {
    return "text-[2.2rem] md:text-[2.3rem]";
  }

  return "text-[2.35rem]";
}

export function MetricTile({ metric }: { metric: MetricCard }) {
  const toneMap = {
    positive: {
      badge: "bg-emerald-50/85 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/12 dark:text-emerald-200 dark:ring-emerald-500/20",
      accent: "from-emerald-500/16 via-emerald-500/6 to-transparent",
    },
    neutral: {
      badge: "bg-blue-50/90 text-blue-800 ring-1 ring-blue-200 dark:bg-blue-500/12 dark:text-blue-200 dark:ring-blue-500/20",
      accent: "from-blue-500/16 via-indigo-500/8 to-transparent",
    },
    warning: {
      badge: "bg-amber-50/90 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/12 dark:text-amber-200 dark:ring-amber-500/20",
      accent: "from-amber-500/18 via-orange-500/8 to-transparent",
    },
  } as const;
  const tone = toneMap[metric.tone];

  return (
    <div className="enterprise-shell-card group relative flex min-h-[240px] flex-col overflow-hidden p-5 transition-transform duration-200 hover:-translate-y-0.5">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-sky-400" />
      <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b opacity-80", tone.accent)} />
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{metric.label}</p>
          <p
            className={cn(
              "mt-3 max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-[var(--font-display)] font-semibold leading-[1.05] tracking-[-0.04em] text-slate-950 dark:text-slate-50",
              getMetricValueClass(metric),
            )}
          >
            {metric.value}
          </p>
        </div>
      </div>
      <div className="mt-auto border-t border-slate-200/70 pt-4 dark:border-white/10">
        <div
          className={cn(
            "flex min-h-16 max-w-full rounded-[1rem] px-4 py-3 text-sm font-medium leading-6 sm:text-[0.95rem]",
            tone.badge,
          )}
        >
          <span className="min-w-0 whitespace-normal break-words">{metric.delta}</span>
        </div>
      </div>
    </div>
  );
}

export function SectionCard({
  title,
  eyebrow,
  action,
  children,
  className,
}: {
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("enterprise-shell-card overflow-hidden", className)}>
      <div className="border-b border-slate-200/70 bg-gradient-to-r from-slate-50/90 via-white to-blue-50/60 px-5 py-4 dark:border-white/10 dark:from-slate-950/80 dark:via-slate-950/70 dark:to-blue-950/30">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {eyebrow ? (
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{eyebrow}</p>
            ) : null}
            <h2 className="mt-2 font-[var(--font-display)] text-[1.35rem] font-semibold tracking-[-0.03em] text-slate-950 dark:text-slate-50">
              {title}
            </h2>
          </div>
          {action}
        </div>
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

export function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "positive" | "warning" | "critical";
}) {
  const toneClasses = {
    neutral: "bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700",
    positive: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/12 dark:text-emerald-300 dark:ring-emerald-500/20",
    warning: "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/12 dark:text-amber-300 dark:ring-amber-500/20",
    critical: "bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/12 dark:text-rose-300 dark:ring-rose-500/20",
  } as const;

  return <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", toneClasses[tone])}>{label}</span>;
}

export function SummaryLabel({
  label,
  tone = "neutral",
  width = "8.75rem",
}: {
  label: string;
  tone?: "neutral" | "positive" | "warning" | "critical";
  width?: number | string;
}) {
  const toneClasses = {
    neutral: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700",
    positive: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/12 dark:text-emerald-300 dark:ring-emerald-500/20",
    warning: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/12 dark:text-amber-300 dark:ring-amber-500/20",
    critical: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/12 dark:text-rose-300 dark:ring-rose-500/20",
  } as const;

  return (
    <span
      className={cn("inline-flex min-h-9 items-center justify-center rounded-xl px-3 text-center text-xs font-semibold ring-1", toneClasses[tone])}
      style={{ minWidth: typeof width === "number" ? `${width}px` : width }}
    >
      {label}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  meta,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <section className="px-1 py-1">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          {eyebrow ? <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-blue-700 dark:text-blue-300">{eyebrow}</p> : null}
          <h1 className="mt-3 font-[var(--font-display)] text-[2rem] font-semibold tracking-[-0.04em] text-slate-950 dark:text-slate-50 md:text-[2.35rem]">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-[0.96rem] leading-7 text-slate-600 dark:text-slate-300">{description}</p>
          {meta ? <div className="mt-5 flex flex-wrap gap-2">{meta}</div> : null}
        </div>
        {action ? <div className="flex flex-wrap gap-3">{action}</div> : null}
      </div>
    </section>
  );
}

export function MiniStat({
  label,
  value,
  accent = "blue",
}: {
  label: string;
  value: string;
  accent?: "blue" | "indigo" | "emerald" | "amber";
}) {
  const accentClass = {
    blue: "from-blue-50 to-white text-blue-700 ring-blue-100 dark:from-blue-500/10 dark:to-slate-950 dark:text-blue-300 dark:ring-blue-500/20",
    indigo: "from-indigo-50 to-white text-indigo-700 ring-indigo-100 dark:from-indigo-500/10 dark:to-slate-950 dark:text-indigo-300 dark:ring-indigo-500/20",
    emerald: "from-emerald-50 to-white text-emerald-700 ring-emerald-100 dark:from-emerald-500/10 dark:to-slate-950 dark:text-emerald-300 dark:ring-emerald-500/20",
    amber: "from-amber-50 to-white text-amber-700 ring-amber-100 dark:from-amber-500/10 dark:to-slate-950 dark:text-amber-300 dark:ring-amber-500/20",
  } as const;

  return (
    <div className={cn("rounded-[1.2rem] bg-gradient-to-br p-4 ring-1", accentClass[accent])}>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-slate-50">{value}</p>
    </div>
  );
}

export function ExecutiveKpi({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "positive" | "warning" | "critical";
}) {
  const accentClass = {
    neutral: "border-slate-200/70 bg-white/80 dark:border-white/10 dark:bg-slate-950/60",
    positive: "border-emerald-200/70 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/10",
    warning: "border-amber-200/70 bg-amber-50/70 dark:border-amber-500/20 dark:bg-amber-500/10",
    critical: "border-rose-200/70 bg-rose-50/70 dark:border-rose-500/20 dark:bg-rose-500/10",
  } as const;

  return (
    <div className={cn("rounded-[1.3rem] border p-4 shadow-sm", accentClass[tone])}>
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-3 font-[var(--font-display)] text-[1.7rem] font-semibold tracking-[-0.04em] text-slate-950 dark:text-slate-50">
        {value}
      </p>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}

export function DisclosurePanel({
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-[1.2rem] border border-slate-200/70 bg-slate-50/75 dark:border-white/10 dark:bg-slate-900/55"
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-4">
        <div>
          <p className="font-semibold text-slate-950 dark:text-slate-50">{title}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{summary}</p>
        </div>
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400 transition group-open:text-blue-600 dark:group-open:text-blue-300">
          View details
        </span>
      </summary>
      <div className="border-t border-slate-200/70 px-4 py-4 dark:border-white/10">{children}</div>
    </details>
  );
}
