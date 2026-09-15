import { useEffect, useMemo, useState } from "react";
import { AlertCircle, RefreshCw, Stethoscope } from "lucide-react";
import { fetchPatients } from "./api/patients";
import { MetricHeader } from "./components/MetricHeader";
import { SearchBar } from "./components/SearchBar";
import { PatientTable } from "./components/PatientTable";
import { PatientDetailDrawer } from "./components/PatientDetailDrawer";
import type { Patient } from "./types/patient";

type LoadState = "loading" | "ready" | "error";

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
  const [patients, setPatients] = useState<Patient[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Patient | null>(null);

  async function load() {
    setState("loading");
    try {
      const data = await fetchPatients();
      setPatients(data);
      setState("ready");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => patients.filter((p) => matchesSearch(p, search)), [patients, search]);

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
            onClick={load}
            disabled={state === "loading"}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={15} className={state === "loading" ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {state === "error" ? (
          <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
            <AlertCircle size={18} />
            <span>Couldn't load patients: {errorMessage}</span>
          </div>
        ) : (
          <>
            <MetricHeader patients={patients} />
            <SearchBar value={search} onChange={setSearch} resultCount={filtered.length} totalCount={patients.length} />
            {state === "loading" ? (
              <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500">
                Loading patients...
              </div>
            ) : (
              <PatientTable patients={filtered} onSelect={setSelected} />
            )}
          </>
        )}
      </main>

      <PatientDetailDrawer patient={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
