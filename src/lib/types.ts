export type MetricCard = {
  label: string;
  value: string;
  delta: string;
  tone: "positive" | "neutral" | "warning";
};
