"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ROUTES } from "@/routes/paths";
import type { MedicalRecord } from "@/types/medical";
import PageShell from "@/components/common/PageShell";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import GenericViewPage, { STANDARD_VIEWS } from "@/components/common/GenericViewPage";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useTableSort } from "@/hooks/useTableSort";
import GenericDomainModal, { type FieldDef } from "@/components/common/GenericDomainModal";
import { useMedicalActions } from "@/hooks/useMedicalActions";
import { useMedicalData } from "@/hooks/useMedicalData";
import { MEDICAL_COLUMNS, SORT_CONFIGS } from "@/components/medical/config";

/** Schema for the medical record edit modal */
const MEDICAL_FIELDS: FieldDef[] = [
  { key: "name", type: "text", label: "Name" },
  { key: "clinic", type: "text", label: "Clinic / Doctor" },
  { key: "date", type: "date", label: "Date" },
  { key: "diagnosis_timeline", type: "richtext", label: "Diagnosis Timeline", minHeight: "8rem" },
];

export default function MedicalAllPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { userId, nowYear, nowMonth, isLoading, error, refreshData, records, documents } =
    useMedicalData();

  // ── Year / Month filter state from URL params ──

  const urlYear = searchParams.get("year");
  const urlMonth = searchParams.get("month");

  const initialYear = urlYear ? Number(urlYear) : nowYear || new Date().getFullYear();
  const initialMonth = urlMonth ? Number(urlMonth) : ("all" as const);

  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedMonth, setSelectedMonth] = useState<number | "all">(initialMonth);
  const [activeView, setActiveView] = useLocalStorage<string>("medicalAllView", "all");

  // ── Derived data ──

  const availableYears = useMemo(() => {
    const currentYear = nowYear || new Date().getFullYear();
    const yearsFromData = new Set(
      records.map((r) => new Date(r.date).getFullYear()),
    );
    yearsFromData.add(currentYear);
    return Array.from(yearsFromData).sort((a, b) => b - a);
  }, [records, nowYear]);

  const availableMonths = useMemo(() => {
    const months = new Set<number>();
    for (const r of records) {
      const d = new Date(r.date);
      if (d.getFullYear() === selectedYear) {
        months.add(d.getMonth());
      }
    }
    return Array.from(months).sort((a, b) => a - b);
  }, [records, selectedYear]);

  const recordsForYear = useMemo(
    () =>
      records.filter((r) => new Date(r.date).getFullYear() === selectedYear),
    [records, selectedYear],
  );

  const recordsForMonth = useMemo(
    () =>
      selectedMonth === "all"
        ? recordsForYear
        : recordsForYear.filter(
            (r) => new Date(r.date).getMonth() === selectedMonth,
          ),
    [recordsForYear, selectedMonth],
  );

  // ── Sort ──

  const { sortState, handleSort, sorted } = useTableSort(
    "medicalAllSortState",
    recordsForMonth,
    SORT_CONFIGS,
  );

  // ── Modal state ──

  const [modalTarget, setModalTarget] = useState<MedicalRecord | null>(null);

  const closeModal = () => setModalTarget(null);

  // ── CRUD handlers ──

  const refresh = useCallback(async () => {
    if (!userId) return;
    await refreshData(userId);
  }, [userId, refreshData]);

  const { createSaveAdapter, handleDelete } = useMedicalActions({ userId, refresh });

  const emptyMessage =
    selectedMonth === "all"
      ? `No medical records found in ${selectedYear}.`
      : `No medical records found in ${selectedYear} for the selected month.`;

  // ── Render ──

  return (
    <>
      <PageShell
        backHref={ROUTES.MEDICAL}
        title="All Medical Records"
        description="Browse all your medical records by year and month."
        error={error}
        onRetry={() => userId && refreshData(userId)}
      >
        {isLoading && <LoadingSpinner />}

        {!isLoading && (
          <GenericViewPage
            items={sorted}
            columns={MEDICAL_COLUMNS}
            getItemKey={(rec) => rec.id}
            views={STANDARD_VIEWS.ALL_ONLY}
            activeView={activeView}
            onViewChange={setActiveView}
            yearFilter={{
              years: availableYears,
              selectedYear,
              onChange: (year) => {
                setSelectedYear(year);
                setSelectedMonth("all");
                router.replace(
                  `${ROUTES.MEDICAL_ALL}?year=${year}`,
                  { scroll: false },
                );
              },
            }}
            monthFilter={{
              months: availableMonths,
              selectedMonth,
              onChange: (month) => {
                setSelectedMonth(month);
                const params = new URLSearchParams();
                params.set("year", String(selectedYear));
                if (month !== "all") params.set("month", String(month));
                router.replace(
                  `${ROUTES.MEDICAL_ALL}?${params.toString()}`,
                  { scroll: false },
                );
              },
            }}
            sortState={sortState}
            onSortChange={handleSort}
            emptyMessage={emptyMessage}
            onRowClick={(rec) => setModalTarget(rec)}
            nowYear={nowYear ?? new Date().getFullYear()}
            nowMonth={nowMonth ?? new Date().getMonth()}
          />
        )}
      </PageShell>

      {modalTarget && userId && (
        <GenericDomainModal
          key={modalTarget.id}
          mode="record"
          title="Edit medical record"
          onClose={closeModal}
          fields={MEDICAL_FIELDS}
          initialData={{
            name: modalTarget.name,
            clinic: modalTarget.clinic,
            date: modalTarget.date,
            diagnosis_timeline: modalTarget.diagnosis_timeline,
          }}
          allowFiles
          allowLinking={false}
          userId={userId}
          attachedDocuments={documents.filter(
            (d) => d.domain === "medical" && d.linked_id === modalTarget.id,
          )}
          standaloneDocuments={[]}
          domain="medical"
          onSave={createSaveAdapter(modalTarget)}
          onDelete={async () => {
            await handleDelete(modalTarget.id);
          }}
          deleteLabel="Delete"
        />
      )}
    </>
  );
}
