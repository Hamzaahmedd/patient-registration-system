import type { ReactNode } from "react";
import { MapPin, Phone, Shield, User, X } from "lucide-react";
import type { Patient } from "../types/patient";
import { formatDateTime, formatPhone, initials } from "../utils/format";

interface PatientDetailDrawerProps {
  patient: Patient | null;
  onClose: () => void;
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm text-slate-800">{value || "—"}</p>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof User; title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Icon size={16} className="text-indigo-500" />
        {title}
      </div>
      <div className="grid grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

export function PatientDetailDrawer({ patient, onClose }: PatientDetailDrawerProps) {
  const open = patient !== null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-slate-900/30 transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Drawer */}
      <aside
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-md transform overflow-y-auto bg-white shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        {patient && (
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                  {initials(patient.first_name, patient.last_name)}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    {patient.first_name} {patient.last_name}
                  </h2>
                  <p className="text-xs text-slate-500">Patient ID {patient.patient_id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close details"
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
              <Section icon={User} title="Demographics">
                <Field label="Date of birth" value={patient.date_of_birth} />
                <Field label="Sex" value={patient.sex} />
                <Field label="Preferred language" value={patient.preferred_language} />
              </Section>

              <Section icon={Phone} title="Contact">
                <Field label="Phone" value={formatPhone(patient.phone_number)} />
                <Field label="Email" value={patient.email} />
              </Section>

              <Section icon={MapPin} title="Address">
                <Field label="Street" value={patient.address_line_1} />
                <Field label="Apt / Suite" value={patient.address_line_2} />
                <Field label="City" value={patient.city} />
                <Field label="State" value={patient.state} />
                <Field label="ZIP code" value={patient.zip_code} />
              </Section>

              <Section icon={Shield} title="Insurance & emergency contact">
                <Field label="Insurance provider" value={patient.insurance_provider} />
                <Field label="Member ID" value={patient.insurance_member_id} />
                <Field label="Emergency contact" value={patient.emergency_contact_name} />
                <Field
                  label="Emergency phone"
                  value={patient.emergency_contact_phone ? formatPhone(patient.emergency_contact_phone) : null}
                />
              </Section>

              <div className="border-t border-slate-100 pt-4 text-xs text-slate-400">
                <p>Registered {formatDateTime(patient.created_at)}</p>
                <p>Last updated {formatDateTime(patient.updated_at)}</p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
