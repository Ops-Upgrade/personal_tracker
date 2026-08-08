"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ROUTES } from "@/routes/paths";
import type { Education } from "@/types/education";
import PageShell from "@/components/common/PageShell";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import GenericViewPage, { STANDARD_VIEWS } from "@/components/common/GenericViewPage";
import type { MonthGroup } from "@/components/common/GenericViewPage";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useEducationActions } from "@/hooks/useEducationActions";
import { useEducationData } from "@/hooks/useEducationData";
import { useTableSort } from "@/hooks/useTableSort";
import { byDueMonth } from "@/lib/viewHelpers";
import EducationModal from "@/components/education/EducationModal";
import { EDUCATION_COLUMNS, SORT_CONFIGS } from "@/components/education/config";

export default function EducationAllPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { userId, istDate, nowYear, nowMonth, isLoading, error, refreshData, educations, documents } =
    useEducationData();

  // ── Year / Month filter state from URL params ──

  const urlYear = searchParams.get("year");
  const urlMonth = searchParams.get("month");

  const initialYear = urlYear ? Number(urlYear) : nowYear || new Date().getFullYear();
  const initialMonth = urlMonth ? Number(urlMonth) : ("all" as const);

  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedMonth, setSelectedMonth] = useState<number | "all">(initialMonth);
  const [activeView, setActiveView] = useLocalStorage<string>("eduAllView", "all");

  // ── Derived data ──

  const availableYears = useMemo(() => {
    const currentYear = nowYear || new Date().getFullYear();
    const yearsFromData = new Set(
      educations.filter((e) => e.due_date).map((e) => new Date(e.due_date!).getFullYear()),
    );
    yearsFromData.add(currentYear);
    return Array.from(yearsFromData).sort((a, b) => b - a);
  }, [educations, nowYear]);

  const availableMonths = useMemo(() => {
    const months = new Set<number>();
    for (const e of educations) {
      if (!e.due_date) continue;
      const d = new Date(e.due_date + "T00:00:00");
      if (d.getFullYear() === selectedYear) {
        months.add(d.getMonth());
      }
    }
    return Array.from(months).sort((a, b) => a - b);
  }, [educations, selectedYear]);

  const educationsForYear = useMemo(
    () =>
      educations.filter((e) => {
        if (!e.due_date) return selectedMonth === "all";
        return new Date(e.due_date + "T00:00:00").getFullYear() === selectedYear;
      }),
    [educations, selectedYear, selectedMonth],
  );

  const educationsForMonth = useMemo(
    () =>
      selectedMonth === "all"
        ? educationsForYear
        : educationsForYear.filter((e) => {
            if (!e.due_date) return false;
            return new Date(e.due_date + "T00:00:00").getMonth() === selectedMonth;
          }),
    [educationsForYear, selectedMonth],
  );

  const monthGroups: MonthGroup<Education>[] = useMemo(
    () => byDueMonth(educationsForYear, selectedYear),
    [educationsForYear, selectedYear],
  );

  // ── Sort ──

  const { sortState, handleSort, sorted } = useTableSort(
    "eduAllSortState",
    educationsForMonth,
    SORT_CONFIGS,
  );

  // ── Modal state ──

  const [modalTarget, setModalTarget] = useState<Education | null>(null);

  const closeModal = () => setModalTarget(null);

  // ── CRUD handlers ──

  const refresh = useCallback(async () => {
    if (!userId) return;
    await refreshData(userId);
  }, [userId, refreshData]);

  const { handleEducationSave: _handleEducationSave, handleEducationDelete, handleDownloadDocument } =
    useEducationActions({ userId, refresh });
  const handleEducationSave: typeof _handleEducationSave = (...args) =>
    _handleEducationSave(...args);

  const emptyMessage =
    selectedMonth === "all"
      ? `No educations found in ${selectedYear}.`
      : `No educations found in ${selectedYear} for the selected month.`;

  // ── Render ──

  return (
    <>
      <PageShell
        backHref={ROUTES.EDUCATION}
        title="All Educations"
        description="Browse all your educations by year and month."
        error={error}
        onRetry={() => userId && refreshData(userId)}
      >
        {isLoading && <LoadingSpinner />}

        {!isLoading && (
          <GenericViewPage
            items={sorted}
            columns={EDUCATION_COLUMNS}
            getItemKey={(e) => e.id}
            views={STANDARD_VIEWS.ALL_MONTHS}
            activeView={activeView}
            onViewChange={setActiveView}
            yearFilter={{
              years: availableYears,
              selectedYear,
              onChange: (year) => {
                setSelectedYear(year);
                setSelectedMonth("all");
                router.replace(
                  `${ROUTES.EDUCATION_ALL}?year=${year}`,
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
                  `${ROUTES.EDUCATION_ALL}?${params.toString()}`,
                  { scroll: false },
                );
              },
            }}
            sortState={sortState}
            onSortChange={handleSort}
            emptyMessage={emptyMessage}
            onRowClick={(e) => setModalTarget(e)}
            monthGroups={monthGroups}
            nowYear={nowYear ?? new Date().getFullYear()}
            nowMonth={nowMonth ?? new Date().getMonth()}
          />
        )}
      </PageShell>

      {modalTarget && userId && (
        <EducationModal
          education={modalTarget}
          defaultDate={istDate}
          documents={documents}
          userId={userId}
          onClose={closeModal}
          onSave={handleEducationSave}
          onDelete={handleEducationDelete}
          onDownloadDocument={handleDownloadDocument}
        />
      )}
    </>
  );
}
