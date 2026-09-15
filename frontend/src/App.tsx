import { useEffect, useMemo, useState } from "react";
import { AlertCircle, PhoneCall, RefreshCw, Stethoscope, Users } from "lucide-react";
import { fetchPatients } from "./api/patients";
import { fetchAllTranscripts } from "./api/transcripts";
import { checkHealth } from "./api/health";
import { MetricHeader } from "./components/MetricHeader";
import { SearchBar } from "./components/SearchBar";
import { PatientTable } from "./components/PatientTable";
import { PatientDetailDrawer } from "./components/PatientDetailDrawer";
import { GlobalTranscriptsView } from "./components/GlobalTranscriptsView";
import type { Patient } from "./types/patient";
import type { Transcript } from "./types/transcript";

type LoadState = "loading" | "ready" | "error";
type Tab = "patients" | "transcripts";
type Health = "checking" | "healthy" | "down";

function matchesSearch(patient: Patient, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;

  const fullName = `${patient.first_name} ${patient.last_name}`.toLowerCase();
  const digits = needle.replace(/\D/g, "");

  const nameMatch = fullName.includes(needle);
  const phoneMatch = digits.length > 0 && patient.phone_number.includes(digits);
  const dobMatch = patient.date_of_birth.includes(needle);

  return nameMatch || phoneMatch || dobMatch;
}

export default function App() {
  const [tab, setTab] = useState<Tab>("patients");

  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientState, setPatientState] = useState<LoadState>("loading");
  const [patientError, setPatientError] = useState("");
  const [search, setSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [selected, setSelected] = useState<Patient | null>(null);

  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [transcriptState, setTranscriptState] = useState<LoadState>("loading");
  const [transcriptError, setTranscriptError] = useState("");

  const [health, setHealth] = useState<Health>("checking");

  async function loadPatients() {
    setPatientState("loading");
    try {
      const data = await fetchPatients(showDeleted);
      setPatients(data);
      setPatientState("ready");
    } catch (err) {
      setPatientError(err instanceof Error ? err.message : "Unknown error");
      setPatientState("error");
    }
  }

  async function loadTranscripts() {
    setTranscriptState("loading");
    try {
      const data = await fetchAllTranscripts();
      setTranscripts(data);
      setTranscriptState("ready");
    } catch (err) {
      setTranscriptError(err instanceof Error ? err.message : "Unknown error");
      setTranscriptState("error");
    }
  }

  async function loadHealth() {
    setHealth("checking");
    const ok = await checkHealth();
    setHealth(ok ? "healthy" : "down");
  }

  function refreshAll() {
    loadPatients();
    loadTranscripts();
    loadHealth();
  }

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run for showDeleted below
  }, []);

  useEffect(() => {
    loadPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadPatients captures showDeleted
  }, [showDeleted]);

  const filtered = useMemo(() => patients.filter((p) => matchesSearch(p, search)), [patients, search]);
  const isLoading = patientState === "loading" || transcriptState === "loading" || health === "checking";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <Stethoscope size={20} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Patient Intake Dashboard</h1>
              <p className="text-xs text-slate-500">Live view over the registration system's REST API</p>
            </div>
          </div>
          <button
            type="button"
            onClick={refreshAll}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <div className="mx-auto flex max-w-6xl gap-1 px-6">
          <button
            type="button"
            onClick={() => setTab("patients")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium ${
              tab === "patients"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Users size={14} />
            Patients
          </button>
          <button
            type="button"
            onClick={() => setTab("transcripts")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium ${
              tab === "transcripts"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <PhoneCall size={14} />
            Call Transcripts
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <MetricHeader patientCount={patients.length} transcriptCount={transcripts.length} health={health} />

        {tab === "patients" ? (
          patientState === "error" ? (
            <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
              <AlertCircle size={18} />
              <span>Couldn't load patients: {patientError}</span>
            </div>
          ) : (
            <>
              <SearchBar
                value={search}
                onChange={setSearch}
                resultCount={filtered.length}
                totalCount={patients.length}
                showDeleted={showDeleted}
                onToggleShowDeleted={setShowDeleted}
              />
              {patientState === "loading" ? (
                <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500">
                  Loading patients...
                </div>
              ) : (
                <PatientTable patients={filtered} onSelect={setSelected} />
              )}
            </>
          )
        ) : (
          <GlobalTranscriptsView
            transcripts={transcripts}
            state={transcriptState}
            errorMessage={transcriptError}
            patients={patients}
          />
        )}
      </main>

      <PatientDetailDrawer patient={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
