"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AdminSyllabusAttentionPanel,
  AdminSyllabusClassHealthSummary,
  AdminSyllabusCoverageTable,
  AdminSyllabusDistributionChart,
  AdminSyllabusFiltersBar,
  AdminSyllabusKpiCards,
  AdminSyllabusPaceFilterChips,
  AdminSyllabusPerformanceCard,
  AdminSyllabusSchoolHealthCard,
  AdminSyllabusTableSearch,
  AdminSyllabusTeacherLeaderboard,
} from "@/components/syllabus-coverage/admin-syllabus-dashboard-ui";
import {
  resolveFilteredDashboard,
  paginateAdminSyllabusTableRows,
  applyAdminSyllabusTableSearch,
} from "@/lib/syllabus-coverage/admin-dashboard-utils";
import type {
  AdminSyllabusDashboardFilters,
  AdminSyllabusDashboardPayload,
  AdminSyllabusTablePageSize,
} from "@/lib/syllabus-coverage/admin-dashboard-types";
import { currentAcademicYear } from "@/lib/student-subject-enrollment";
import { loadAdminSyllabusDashboardAction } from "./actions";

function defaultFilters(academicYear: string): AdminSyllabusDashboardFilters {
  return {
    academicYear,
    term: "All Terms",
    classId: "all",
    subjectKey: "all",
    teacherId: "all",
    paceChip: "all",
  };
}

export function AdminSyllabusCoverageClient() {
  const [payload, setPayload] = useState<AdminSyllabusDashboardPayload | null>(
    null
  );
  const [filters, setFilters] = useState<AdminSyllabusDashboardFilters>(() =>
    defaultFilters(String(currentAcademicYear()))
  );
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<AdminSyllabusTablePageSize>(10);
  const [tableSearch, setTableSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (year: string) => {
    setLoading(true);
    const res = await loadAdminSyllabusDashboardAction(year);
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      setPayload(null);
      return;
    }
    setPayload(res.payload);
    setFilters((prev) => ({
      ...prev,
      academicYear: res.payload.academicYear,
      term: res.payload.filterOptions.terms.includes(prev.term)
        ? prev.term
        : "All Terms",
    }));
  }, []);

  useEffect(() => {
    void load(filters.academicYear);
  }, [filters.academicYear, load]);

  useEffect(() => {
    setPage(1);
  }, [filters, tableSearch]);

  const resolved = useMemo(() => {
    if (!payload) {
      return null;
    }
    return resolveFilteredDashboard(payload, filters);
  }, [payload, filters]);

  const searchedTableRows = useMemo(() => {
    if (!resolved) {
      return [];
    }
    return applyAdminSyllabusTableSearch(resolved.tableRows, tableSearch);
  }, [resolved, tableSearch]);

  const tablePagination = useMemo(() => {
    return paginateAdminSyllabusTableRows(searchedTableRows, page, rowsPerPage);
  }, [searchedTableRows, page, rowsPerPage]);

  const updateFilters = (next: Partial<AdminSyllabusDashboardFilters>) => {
    setFilters((prev) => {
      const merged = { ...prev, ...next };
      if (next.academicYear && next.academicYear !== prev.academicYear) {
        void load(next.academicYear);
      }
      return merged;
    });
  };

  const filterOptions = payload?.filterOptions ?? {
    academicYears: [String(currentAcademicYear())],
    terms: ["All Terms"],
    classes: [],
    subjects: [],
    teachers: [],
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          Syllabus Coverage
        </h1>
        <p className="text-sm text-slate-600 dark:text-zinc-400">
          Academic management dashboard for school-wide teaching progress,
          expected pace, and performance insights.
        </p>
      </header>

      <AdminSyllabusFiltersBar
        filterOptions={filterOptions}
        filters={filters}
        onChange={updateFilters}
      />

      {resolved ? (
        <>
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-stretch">
            <AdminSyllabusKpiCards kpis={resolved.kpis} />
            <AdminSyllabusSchoolHealthCard schoolHealth={resolved.schoolHealth} />
          </div>

          <AdminSyllabusDistributionChart distribution={resolved.distribution} />

          <div className="grid gap-4 lg:grid-cols-2">
            <AdminSyllabusAttentionPanel items={resolved.attention} />
            <AdminSyllabusTeacherLeaderboard teachers={resolved.teachers} />
          </div>

          <AdminSyllabusPerformanceCard rows={resolved.performance} />

          <AdminSyllabusClassHealthSummary classes={resolved.classHealth} />

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-300">
              Coverage by class & subject
            </h2>
            <AdminSyllabusTableSearch
              value={tableSearch}
              onChange={setTableSearch}
            />
            <AdminSyllabusPaceFilterChips
              value={filters.paceChip}
              onChange={(paceChip) => updateFilters({ paceChip })}
            />
            <AdminSyllabusCoverageTable
              rows={resolved ? tablePagination.slice : []}
              allRows={resolved?.rows}
              loading={loading}
              pagination={
                resolved && tablePagination.totalRecords > 0
                  ? {
                      page: tablePagination.page,
                      rowsPerPage: tablePagination.rowsPerPage,
                      totalRecords: tablePagination.totalRecords,
                      startRecord: tablePagination.startRecord,
                      endRecord: tablePagination.endRecord,
                      totalPages: tablePagination.totalPages,
                      onPageChange: setPage,
                      onRowsPerPageChange: (nextRowsPerPage) => {
                        setRowsPerPage(nextRowsPerPage);
                        setPage(1);
                      },
                    }
                  : undefined
              }
            />
          </section>
        </>
      ) : (
        <AdminSyllabusCoverageTable rows={[]} loading={loading} />
      )}
    </div>
  );
}
