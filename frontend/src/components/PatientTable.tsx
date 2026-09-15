import type { Patient } from "../types/patient";
import { formatDateTime, formatPhone, initials } from "../utils/format";

interface PatientTableProps {
  patients: Patient[];
  onSelect: (patient: Patient) => void;
}

const AVATAR_PALETTE = [
  "bg-indigo-100 text-indigo-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700",
  "bg-rose-100 text-rose-700",
  "bg-violet-100 text-violet-700",
];

function avatarColor(seed: string): string {
  const index = seed.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index];
}

function fullAddress(p: Patient): string {
  const line2 = p.address_line_2 ? `, ${p.address_line_2}` : "";
  return `${p.address_line_1}${line2}, ${p.city}, ${p.state} ${p.zip_code}`;
}

export function PatientTable({ patients, onSelect }: PatientTableProps) {
  if (patients.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">
        No patients match your search.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[920px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <th className="px-5 py-3 font-medium">Patient</th>
            <th className="px-5 py-3 font-medium">Date of birth</th>
            <th className="px-5 py-3 font-medium">Sex</th>
            <th className="px-5 py-3 font-medium">Phone</th>
            <th className="px-5 py-3 font-medium">Address</th>
            <th className="px-5 py-3 font-medium">Insurance</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {patients.map((p) => {
            const isDeleted = p.deleted_at !== null;
            return (
              <tr
                key={p.patient_id}
                onClick={() => onSelect(p)}
                className={`cursor-pointer transition-colors hover:bg-indigo-50/40 ${isDeleted ? "opacity-60" : ""}`}
              >
                <td className="whitespace-nowrap px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarColor(
                        p.patient_id,
                      )}`}
                    >
                      {initials(p.first_name, p.last_name)}
                    </div>
                    <span className="font-medium text-slate-800">
                      {p.first_name} {p.last_name}
                    </span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-slate-600">{p.date_of_birth}</td>
                <td className="whitespace-nowrap px-5 py-3 text-slate-600">{p.sex}</td>
                <td className="whitespace-nowrap px-5 py-3 text-slate-600">{formatPhone(p.phone_number)}</td>
                <td className="max-w-[220px] truncate px-5 py-3 text-slate-600" title={fullAddress(p)}>
                  {fullAddress(p)}
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-slate-600">{p.insurance_provider ?? "—"}</td>
                <td className="whitespace-nowrap px-5 py-3">
                  {isDeleted ? (
                    <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
                      Deleted
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      Active
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-slate-500">{formatDateTime(p.created_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
