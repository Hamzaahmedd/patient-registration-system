import { useEffect, useState, type ReactNode } from "react";
import { MapPin, Phone, PhoneCall, Shield, User, X } from "lucide-react";
import type { Patient } from "../types/patient";
import type { Transcript } from "../types/transcript";
import { fetchPatientTranscripts } from "../api/transcripts";
import { formatDateTime, formatPhone, initials } from "../utils/format";
import { TranscriptListItem } from "./TranscriptListItem";

interface PatientDetailDrawerProps {
  patient: Patient | null;
  onClose: () => void;
}

type Tab = "details" | "history";

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

function CallHistoryPanel({ patientId }: { patientId: string }) {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    fetchPatientTranscripts(patientId)
      .then((data) => {
        if (!cancelled) {
          setTranscripts(data);
          setState("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  if (state === "loading") {
    return <p className="text-sm text-slate-500">Loading call history...</p>;
  }
  if (state === "error") {
    return <p className="text-sm text-rose-600">Couldn't load call history.</p>;
  }
  if (transcripts.length === 0) {
    return <p className="text-sm text-slate-500">No calls on record for this patient yet.</p>;
  }
  return (
    <div className="space-y-3">
      {transcripts.map((t) => (
        <TranscriptListItem key={t.id} transcript={t} />
      ))}
    </div>
  );
}

export function PatientDetailDrawer({ patient, onClose }: PatientDetailDrawerProps) {
  const open = patient !== null;
  const [tab, setTab] = useState<Tab>("details");

  // Reset to the Details tab whenever a different patient is opened.
  useEffect(() => {
    if (patient) setTab("details");
  }, [patient]);

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

            <div className="flex border-b border-slate-100 px-6">
              <button
                type="button"
                onClick={() => setTab("details")}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium ${
                  tab === "details"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <User size={14} />
                Details
              </button>
              <button
                type="button"
                onClick={() => setTab("history")}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium ${
                  tab === "history"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <PhoneCall size={14} />
                Call History
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {tab === "details" ? (
                <div className="space-y-8">
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
                    {patient.deleted_at && <p className="text-rose-500">Deleted {formatDateTime(patient.deleted_at)}</p>}
                  </div>
                </div>
              ) : (
                <CallHistoryPanel patientId={patient.patient_id} />
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
