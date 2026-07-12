"use client";

import { useMemo, useState } from "react";
import type { Education } from "@/types/education";
import { trunc } from "./helpers";

interface BulkLinkModalProps {
  educations: Education[];
  selectedCount: number;
  isProcessing?: boolean;
  onClose: () => void;
  onSave: (educationId: string) => Promise<void>;
}

/**
 * Modal for bulk-linking unlinked certificates to a single education record.
 *
 * Reusable for any future flow requiring a user to "Move to" or "Link to"
 * a specific education record en masse.
 */
export default function BulkLinkModal({
  educations,
  selectedCount,
  isProcessing = false,
  onClose,
  onSave,
}: BulkLinkModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEduId, setSelectedEduId] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const filteredEducations = useMemo(() => {
    if (!searchQuery.trim()) return educations;
    const q = searchQuery.toLowerCase();
    return educations.filter(
      (e) =>
        (e.name || "").toLowerCase().includes(q) ||
        (e.provider || "").toLowerCase().includes(q)
    );
  }, [educations, searchQuery]);

  const selectedEdu = selectedEduId
    ? educations.find((e) => e.id === selectedEduId)
    : null;
  const displayValue = selectedEduId && selectedEdu
    ? trunc(selectedEdu.name, 55)
    : searchQuery;

  const handleSave = async () => {
    if (!selectedEduId || isProcessing) return;
    await onSave(selectedEduId);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Bulk Link
        </h3>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Link {selectedCount} unlinked certificate{selectedCount !== 1 ? "s" : ""} to a single education record.
        </p>

        {/* Searchable education dropdown */}
        <div className="relative mt-3">
          <span className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Target education record
          </span>
          <div className="relative flex items-center">
            <input
              type="text"
              value={displayValue}
              onChange={(e) => {
                if (selectedEduId) setSelectedEduId("");
                setSearchQuery(e.target.value);
                if (!dropdownOpen) setDropdownOpen(true);
              }}
              onFocus={() => {
                if (!dropdownOpen) setDropdownOpen(true);
              }}
              onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
              placeholder="Search education..."
              disabled={isProcessing}
              className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 pr-16 text-xs outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              {selectedEduId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEduId("");
                    setSearchQuery("");
                  }}
                  className="px-1 py-0.5 text-xs font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded"
                  title="Clear selection"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setDropdownOpen((prev) => !prev)}
                disabled={isProcessing}
                className="p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 disabled:opacity-50"
              >
                <svg
                  className="h-3.5 w-3.5 shrink-0"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Dropdown popup */}
          {dropdownOpen && (
            <div className="absolute z-20 mt-1 w-full rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              {filteredEducations.length > 0 ? (
                <div className="max-h-36 overflow-y-auto">
                  {filteredEducations.map((edu) => (
                    <button
                      key={edu.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setSelectedEduId(edu.id);
                        setSearchQuery("");
                        setDropdownOpen(false);
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-emerald-50 hover:text-emerald-700 dark:text-zinc-300 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400"
                    >
                      {trunc(edu.name, 55)}
                      {edu.is_completed ? " ✓" : ""}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-3 py-2 text-xs text-zinc-400">
                  {searchQuery
                    ? "No matching educations"
                    : "No educations available"}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="inline-flex items-center rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedEduId || isProcessing}
            className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? "Linking..." : "Link All"}
          </button>
        </div>
      </div>
    </div>
  );
}
