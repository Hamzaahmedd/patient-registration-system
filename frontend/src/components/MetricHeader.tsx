import { Activity, PhoneCall, Users } from "lucide-react";
import { MetricCard } from "./MetricCard";

interface MetricHeaderProps {
  patientCount: number;
  transcriptCount: number;
  health: "checking" | "healthy" | "down";
}

const HEALTH_LABEL: Record<MetricHeaderProps["health"], string> = {
  checking: "Checking...",
  healthy: "Healthy",
  down: "Unreachable",
};

const HEALTH_ACCENT: Record<MetricHeaderProps["health"], "indigo" | "emerald" | "sky" | "rose"> = {
  checking: "sky",
  healthy: "emerald",
  down: "rose",
};

export function MetricHeader({ patientCount, transcriptCount, health }: MetricHeaderProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <MetricCard label="Total patients" value={patientCount} icon={Users} accent="indigo" />
      <MetricCard label="Total call transcripts" value={transcriptCount} icon={PhoneCall} accent="sky" />
      <MetricCard label="System health" value={HEALTH_LABEL[health]} icon={Activity} accent={HEALTH_ACCENT[health]} />
    </div>
  );
}
