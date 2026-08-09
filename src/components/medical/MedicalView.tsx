"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ROUTES } from "@/routes/paths";
import Button from "@/components/common/Button";
import { useQueryModal } from "@/lib/useQueryModal";
import { parseISTDate } from "@/api/serverDate";
import type { MedicalRecord } from "@/types/medical";
import { MONTHS } from "@/types/common";
import { useLocalStorage } from "@/lib/useLocalStorage";
import ViewToggle from "@/components/common/ViewToggle";
import type { ViewToggleOption } from "@/components/common/ViewToggle";
import { List, LayoutGrid, Table } from "lucide-react";
import { FolderIcon, PaperClipIcon } from "@/components/common/Icons";
import BoxContainer, { SCROLLABLE_CLASSES } from "@/components/common/BoxContainer";
import GenericDomainPage from "@/components/common/GenericDomainPage";
import type { DomainPageContext } from "@/components/common/GenericDomainPage";
import type { ColumnDef } from "@/components/common/GenericViewPage";
import GenericDomainModal, { type FieldDef } from "@/components/common/GenericDomainModal";
import { useMedicalActions } from "@/hooks/useMedicalActions";
import { useMedicalData } from "@/hooks/useMedicalData";
import MedicalTable from "./MedicalTable";
import GenericMonthRow from "@/components/common/GenericMonthRow";
import YearDropdown from "@/components/common/YearDropdown";
import { trunc } from "@/lib/viewHelpers";

type MedicalViewMode = "all" | "single" | "multi";

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** SVG icon symbols for the medical view toggle */
const MEDICAL_VIEW_OPTIONS: readonly ViewToggleOption<MedicalViewMode>[] = [
  { value: "all", label: <Table className="h-4 w-4" /> },
  { value: "single", label: <List className="h-4 w-4" /> },
  { value: "multi", label: <LayoutGrid className="h-4 w-4" />, hideOnMobile: true },
];

/** Schema for the medical record create/edit modal */
const MEDICAL_FIELDS: FieldDef[] = [
  { key: "name", type: "text", label: "Name" },
  { key: "clinic", type: "text", label: "Clinic / Doctor" },
  { key: "date", type: "date", label: "Date" },
  { key: "diagnosis_timeline", type: "richtext", label: "Diagnosis Timeline", minHeight: "8rem" },
];

/**
 * Medical Records feature shell.
 * Orchestrates month list, year dropdown, and create/edit medical record modals.
 * "View All" navigates to the dedicated /medical/all route with month/year params.
 * Query-param-driven modals via useQueryModal ("medical" prefix).
 * Layout shell delegated to GenericDomainPage (full-width).
 */
export default function MedicalView() {
  const { userId, istDate, isLoading, error, refreshData, records, documents } =
    useMedicalData();

  const istParsed = useMemo(() => (istDate ? parseISTDate(istDate) : null), [istDate]);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [viewMode, setViewMode] = useLocalStorage<MedicalViewMode>("medicalViewMode", "all");

  // Query-param-driven modal state via shared hook
  const { modalTarget, openCreate, openEdit, closeModal } = useQueryModal(records, "medical");

  // Auto-scroll to the current month tile on load / view change
  useEffect(() => {
    if (isLoading || viewMode === "all") return;
    const timeout = setTimeout(() => {
      document
        .getElementById("current-month-tile")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => clearTimeout(timeout);
  }, [isLoading, selectedYear, viewMode]);

  // ── Derived data ──

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearsFromData = new Set(
      records.map((r) => new Date(r.date).getFullYear())
    );
    yearsFromData.add(currentYear);
    return Array.from(yearsFromData).sort((a, b) => b - a);
  }, [records]);

  const recordsByMonth = useMemo(() => {
    return MONTHS.map((monthName, monthIndex) => {
      const filtered = records.filter((r) => {
        const d = new Date(r.date);
        return d.getFullYear() === selectedYear && d.getMonth() === monthIndex;
      });
      return { monthName, monthIndex, records: filtered };
    });
  }, [records, selectedYear]);

  const recordsForSelectedYear = useMemo(() => {
    return records.filter((r) => new Date(r.date).getFullYear() === selectedYear);
  }, [records, selectedYear]);

  const totalRecords = recordsForSelectedYear.length;

  // ── Column definitions for month preview rows ──

  const medicalColumns: ColumnDef<MedicalRecord>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Name",
        colSpan: 3,
        render: (rec) => (
          <span className="font-medium text-zinc-800 dark:text-zinc-100">
            {trunc(rec.name, 24) || "—"}
          </span>
        ),
      },
      {
        key: "clinic",
        header: "Clinic",
        colSpan: 2,
        render: (rec) => (
          <span className="text-zinc-600 dark:text-zinc-300">
            {trunc(rec.clinic, 20) || "—"}
          </span>
        ),
      },
      {
        key: "date",
        header: "Date",
        colSpan: 2,
        render: (rec) => (
          <span className="text-zinc-600 dark:text-zinc-300">
            {formatShortDate(rec.date)}
          </span>
        ),
      },
      {
        key: "diagnosis",
        header: "Diagnosis",
        colSpan: 3,
        render: (rec) => (
          <span className="text-zinc-500 dark:text-zinc-400">
            {trunc(rec.diagnosis_timeline, 28) || "—"}
          </span>
        ),
      },
      {
        key: "files",
        header: "Files",
        colSpan: 2,
        render: (rec) => {
          const count = rec.document_ids?.length ?? 0;
          return count > 0 ? (
            <span className="inline-flex items-center justify-center gap-1 text-rose-500" title={`${count} document(s) attached`}>
              <PaperClipIcon className="h-4 w-4" />
              <span className="text-zinc-600 dark:text-zinc-300">({count})</span>
            </span>
          ) : (
            <span className="text-zinc-400">—</span>
          );
        },
      },
    ],
    [],
  );

  // ── CRUD handlers ──

  const refresh = useCallback(async () => {
    if (!userId) return;
    await refreshData(userId);
  }, [userId, refreshData]);

  const { createSaveAdapter, handleDelete } = useMedicalActions({ userId, refresh });

  // ── Context for GenericDomainPage ──

  const ctx: DomainPageContext = useMemo(
    () => ({
      userId,
      istDate,
      nowYear: new Date().getFullYear(),
      nowMonth: new Date().getMonth(),
      isLoading,
      error,
      refreshData,
    }),
    [userId, istDate, isLoading, error, refreshData],
  );

  // ── Render ──

  return (
    <GenericDomainPage
      ctx={ctx}
      title="Medical Records"
      description="Track and manage your medical history."
      backHref={ROUTES.DASHBOARD}
      storeHref={ROUTES.MEDICAL_STORE}
      storeLabel="Document Store"
      storeIcon={<FolderIcon className="h-5 w-5 text-red-500" />}
      headerStat={
        !isLoading ? (
          <p className="mt-2 text-base font-medium text-zinc-700 dark:text-zinc-300">
            Total Records:{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {totalRecords} record{totalRecords !== 1 ? "s" : ""}
            </span>
          </p>
        ) : undefined
      }
      modalSlot={
        modalTarget && userId && (
          <GenericDomainModal
            key={modalTarget === "create" ? "create" : modalTarget.id}
            mode="record"
            title={
              modalTarget === "create"
                ? "Add medical record"
                : "Edit medical record"
            }
            onClose={closeModal}
            fields={MEDICAL_FIELDS}
            initialData={{
              name: modalTarget === "create" ? "" : modalTarget.name,
              clinic: modalTarget === "create" ? "" : modalTarget.clinic,
              date:
                modalTarget === "create"
                  ? (istDate ?? "")
                  : modalTarget.date,
              diagnosis_timeline:
                modalTarget === "create"
                  ? ""
                  : modalTarget.diagnosis_timeline,
            }}
            allowFiles
            allowLinking={false}
            userId={userId}
            attachedDocuments={
              modalTarget !== "create"
                ? documents.filter(
                    (d) => d.domain === "medical" && d.linked_id === modalTarget.id,
                  )
                : []
            }
            standaloneDocuments={[]}
            domain="medical"
            onSave={createSaveAdapter(
              modalTarget === "create" ? null : modalTarget,
              modalTarget === "create"
                ? (saved) => openEdit(saved)
                : undefined,
            )}
            onDelete={
              modalTarget !== "create"
                ? async () => {
                    await handleDelete(modalTarget.id);
                  }
                : undefined
            }
            deleteLabel="Delete"
          />
        )
      }
      renderBody={() => (
        <BoxContainer>
          <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {viewMode === "all" ? "All Records" : "Records"}
              </h2>
              <ViewToggle
                value={viewMode}
                onChange={setViewMode}
                options={MEDICAL_VIEW_OPTIONS}
                ariaLabel="Medical view toggle"
                hideContainerOnMobile={false}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="md" onClick={() => openCreate()} disabled={isLoading}>
                + Add
              </Button>
              <YearDropdown
                years={availableYears}
                selectedYear={selectedYear}
                onChange={setSelectedYear}
              />
            </div>
          </header>
          {viewMode === "all" ? (
            <div className={SCROLLABLE_CLASSES}>
              <MedicalTable records={recordsForSelectedYear} onSelectRecord={openEdit} />
            </div>
          ) : (
            <div className={`${SCROLLABLE_CLASSES} flex flex-col md:flex-row gap-4 items-start`}>
              {/* Left Column (or Single Column) */}
              <div className="flex-1 flex flex-col gap-4 w-full">
                {recordsByMonth
                  .filter((_, i) => viewMode === "multi" ? i % 2 === 0 : true)
                  .map(({ monthName, monthIndex, records: monthRecords }) => {
                    const isCurrentMonth =
                      istParsed !== null &&
                      selectedYear === istParsed.year &&
                      monthIndex === istParsed.month;
                    return (
                      <GenericMonthRow
                        key={`month-${monthName}`}
                        monthName={monthName}
                        monthIndex={monthIndex}
                        year={selectedYear}
                        items={monthRecords}
                        isCurrentMonth={isCurrentMonth}
                        getDate={(record) => record.date}
                        getSubtitle={(items) => {
                          const count = items.length;
                          return <>{count} record{count !== 1 ? "s" : ""}</>;
                        }}
                        columns={medicalColumns}
                        getItemKey={(record) => record.id}
                        previewCount={5}
                        onRowClick={(record) => openEdit(record)}
                        viewAllHref={`${ROUTES.MEDICAL_ALL}?year=${selectedYear}&month=${monthIndex}`}
                      />
                    );
                  })}
              </div>

              {/* Right Column (only visible in multi view) */}
              {viewMode === "multi" && (
                <div className="flex-1 flex-col gap-4 w-full hidden md:flex">
                  {recordsByMonth
                    .filter((_, i) => i % 2 !== 0)
                    .map(({ monthName, monthIndex, records: monthRecords }) => {
                      const isCurrentMonth =
                        istParsed !== null &&
                        selectedYear === istParsed.year &&
                        monthIndex === istParsed.month;
                      return (
                        <GenericMonthRow
                          key={`month-${monthName}`}
                          monthName={monthName}
                          monthIndex={monthIndex}
                          year={selectedYear}
                          items={monthRecords}
                          isCurrentMonth={isCurrentMonth}
                          getDate={(record) => record.date}
                          getSubtitle={(items) => {
                            const count = items.length;
                            return <>{count} record{count !== 1 ? "s" : ""}</>;
                          }}
                          columns={medicalColumns}
                          getItemKey={(record) => record.id}
                          previewCount={5}
                          onRowClick={(record) => openEdit(record)}
                          viewAllHref={`${ROUTES.MEDICAL_ALL}?year=${selectedYear}&month=${monthIndex}`}
                        />
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </BoxContainer>
      )}
    />
  );
}
