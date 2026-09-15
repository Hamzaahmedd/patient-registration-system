import { CalendarCheck, ShieldCheck, Users } from "lucide-react";
import type { Patient } from "../types/patient";
import { isSameLocalDay } from "../utils/format";
import { MetricCard } from "./MetricCard";

interface MetricHeaderProps {
  patients: Patient[];
}

export function MetricHeader({ patients }: MetricHeaderProps) {
  const today = new Date();
  const todaysRegistrations = patients.filter((p) => isSameLocalDay(new Date(p.created_at), today)).length;
  const insured = patients.filter((p) => Boolean(p.insurance_provider)).length;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <MetricCard label="Total patients" value={patients.length} icon={Users} accent="indigo" />
      <MetricCard label="Today's registrations" value={todaysRegistrations} icon={CalendarCheck} accent="emerald" />
      <MetricCard label="With insurance on file" value={insured} icon={ShieldCheck} accent="sky" />
    </div>
  );
}
