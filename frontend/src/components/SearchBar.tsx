import { Search, X } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  resultCount: number;
  totalCount: number;
  showDeleted: boolean;
  onToggleShowDeleted: (value: boolean) => void;
}

export function SearchBar({
  value,
  onChange,
  resultCount,
  totalCount,
  showDeleted,
  onToggleShowDeleted,
}: SearchBarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-sm">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search by name, phone, or date of birth..."
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={(e) => onToggleShowDeleted(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
          />
          Show deleted
        </label>
        <p className="whitespace-nowrap text-sm text-slate-500">
          {value ? (
            <>
              Showing <span className="font-medium text-slate-700">{resultCount}</span> of {totalCount}
            </>
          ) : (
            <>
              <span className="font-medium text-slate-700">{totalCount}</span> patient{totalCount === 1 ? "" : "s"}
            </>
          )}
        </p>
      </div>
    </div>
  );
}
