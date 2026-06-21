"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  ContactHasFilter,
  ContactPlanFilter,
  ContactStatusFilter,
  ContactTypeFilter,
  SuperAdminContactsResponse,
} from "@/lib/super-admin/contacts-types";
import {
  SuperAdminExportLink,
  SuperAdminLoadingButton,
  useCopyWithFeedback,
} from "@/components/super-admin/super-admin-loading-action";
import {
  ContactsCoverageWidget,
  ContactsExecutiveHeader,
  ContactsInsightChips,
  ContactsQuickActions,
  ContactsTableHeader,
  ContactMobileCard,
  ContactTableRow,
} from "./contacts-center-ui";
import {
  buildContactsFilterChips,
  buildContactsFilterSummaryItems,
  ContactsActiveFilterSummary,
  ContactsDirectoryHeader,
  ContactsFilteredEmptyState,
  ContactsFilterBadgesRow,
  ContactsFilterResultCounter,
  ContactsFiltersAppliedBadge,
  ContactsHasFilterSelect,
  CONTACTS_EMAIL_FILTER_OPTIONS,
  CONTACTS_PHONE_FILTER_OPTIONS,
  countContactsActiveFilters,
  EMAIL_FILTER_TOOLTIPS,
  EMAIL_FILTER_LABELS,
  PHONE_FILTER_TOOLTIPS,
  PHONE_FILTER_LABELS,
} from "./contacts-filter-ui";
import {
  saBtnSecondarySm,
  saDirectoryToolbar,
  saFilterTabActive,
  saFilterTabInactive,
  saInput,
  saSearchInput,
  saSection,
  SaKpiCard,
} from "@/components/super-admin/super-admin-dashboard-ui";
import { cn } from "@/lib/utils";
import { SchoolIntelligenceContextBanner } from "@/components/super-admin/smart-intelligence/school-intelligence-context-banner";
import { useSchoolIntelligenceContext } from "@/components/super-admin/smart-intelligence/use-school-intelligence-context";
import {
  buildSchoolContactsHref,
  isFromIntelligenceNavigation,
  intelligenceDashboardHref,
  parseIntelligenceNavigationFromSearchParams,
  type ContactsRowActionContext,
  type SmartIntelligenceNavigationContext,
} from "@/lib/super-admin/smart-intelligence-navigation";

const ROWS_PER_PAGE_OPTIONS = [25, 50, 100] as const;

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function ContactsCenterClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolSelectRef = useRef<HTMLSelectElement>(null);
  const intelligenceNav = useMemo(
    () => parseIntelligenceNavigationFromSearchParams(searchParams),
    [searchParams]
  );
  const fromIntelligence = isFromIntelligenceNavigation(searchParams);
  const urlSchoolId = searchParams.get("schoolId")?.trim() ?? "";

  const phoneCopy = useCopyWithFeedback();
  const emailCopy = useCopyWithFeedback();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ContactTypeFilter>("all");
  const [planFilter, setPlanFilter] = useState<ContactPlanFilter>("all");
  const [statusFilter, setStatusFilter] = useState<ContactStatusFilter>("all");
  const [schoolFilter, setSchoolFilter] = useState(urlSchoolId);
  const [hasPhone, setHasPhone] = useState<ContactHasFilter>("all");
  const [hasEmail, setHasEmail] = useState<ContactHasFilter>("all");
  const [includeEmpty, setIncludeEmpty] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] =
    useState<(typeof ROWS_PER_PAGE_OPTIONS)[number]>(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SuperAdminContactsResponse | null>(null);

  const activeSchoolId =
    schoolFilter || intelligenceNav?.schoolId || urlSchoolId || null;
  const { data: schoolContextPayload, loading: schoolContextLoading } =
    useSchoolIntelligenceContext(activeSchoolId);

  const activeSchoolName = useMemo(() => {
    if (intelligenceNav?.schoolName && intelligenceNav.schoolId === activeSchoolId) {
      return intelligenceNav.schoolName;
    }
    if (schoolContextPayload?.school.name) return schoolContextPayload.school.name;
    const fromOptions = (data?.schoolOptions ?? []).find(
      (s) => s.id === activeSchoolId
    )?.name;
    return fromOptions ?? searchParams.get("schoolName")?.trim() ?? "";
  }, [
    intelligenceNav,
    activeSchoolId,
    schoolContextPayload?.school.name,
    data?.schoolOptions,
    searchParams,
  ]);

  useEffect(() => {
    setSchoolFilter(urlSchoolId);
  }, [urlSchoolId]);

  function replaceContactsUrl(nextSchoolId: string, schoolName?: string) {
    if (!nextSchoolId) {
      router.replace("/super-admin/contacts");
      return;
    }

    const ctx: SmartIntelligenceNavigationContext = {
      schoolId: nextSchoolId,
      schoolName: schoolName ?? "",
      source: intelligenceNav?.source ?? "general",
      riskLevel: intelligenceNav?.riskLevel,
      engagementScore: intelligenceNav?.engagementScore,
      onboardingProgress: intelligenceNav?.onboardingProgress,
    };

    if (fromIntelligence) {
      router.replace(buildSchoolContactsHref(ctx));
      return;
    }

    const params = new URLSearchParams();
    params.set("schoolId", nextSchoolId);
    if (schoolName) params.set("schoolName", schoolName);
    router.replace(`/super-admin/contacts?${params.toString()}`);
  }

  function clearSchoolContextFilter() {
    setSchoolFilter("");
    setPage(1);
    router.replace("/super-admin/contacts");
  }

  function focusSchoolPicker() {
    setSchoolFilter("");
    router.replace("/super-admin/contacts");
    window.setTimeout(() => schoolSelectRef.current?.focus(), 100);
  }

  function handleSchoolFilterChange(nextSchoolId: string) {
    setSchoolFilter(nextSchoolId);
    setPage(1);
    const schoolName =
      (data?.schoolOptions ?? []).find((s) => s.id === nextSchoolId)?.name ?? "";
    replaceContactsUrl(nextSchoolId, schoolName);
  }

  const effectiveSchoolId = schoolFilter || urlSchoolId || intelligenceNav?.schoolId || "";

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (search.trim()) params.set("search", search.trim());
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (planFilter !== "all") params.set("plan", planFilter);
    if (statusFilter !== "all") params.set("schoolStatus", statusFilter);
    if (effectiveSchoolId) params.set("schoolId", effectiveSchoolId);
    if (hasPhone !== "all") params.set("hasPhone", hasPhone);
    if (hasEmail !== "all") params.set("hasEmail", hasEmail);
    if (includeEmpty) params.set("includeEmpty", "1");
    return params.toString();
  }, [
    page,
    limit,
    search,
    typeFilter,
    planFilter,
    statusFilter,
    schoolFilter,
    hasPhone,
    hasEmail,
    includeEmpty,
    effectiveSchoolId,
  ]);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/super-admin/contacts?${queryString}`, {
        credentials: "same-origin",
      });
      const body = (await res.json()) as SuperAdminContactsResponse & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(body.error || "Failed to load contacts.");
      }
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load contacts.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    typeFilter,
    planFilter,
    statusFilter,
    schoolFilter,
    hasPhone,
    hasEmail,
    includeEmpty,
    limit,
  ]);

  useEffect(() => {
    if (!data || data.totalPages <= 0) return;
    if (page > data.totalPages) setPage(1);
  }, [data, page]);

  function buildExportUrl(
    format: "csv" | "excel",
    typeOverride?: ContactTypeFilter
  ) {
    const params = new URLSearchParams(queryString);
    params.delete("page");
    params.delete("limit");
    if (typeOverride && typeOverride !== "all") {
      params.set("type", typeOverride);
    }
    params.set("export", format);
    return `/api/super-admin/contacts?${params.toString()}`;
  }

  async function copyVisiblePhones() {
    const phones = data?.filteredPhones ?? [];
    if (phones.length === 0) {
      alert("No phone numbers match your filters.");
      return;
    }
    const ok = await phoneCopy.copy(phones.join("\n"), () =>
      alert("Could not copy phone numbers.")
    );
    if (!ok) return;
  }

  async function copyVisibleEmails() {
    const emails = data?.filteredEmails ?? [];
    if (emails.length === 0) {
      alert("No email addresses match your filters.");
      return;
    }
    const ok = await emailCopy.copy(emails.join("\n"), () =>
      alert("Could not copy email addresses.")
    );
    if (!ok) return;
  }

  const copyBusy = phoneCopy.isCopying || emailCopy.isCopying;

  function clearFilters() {
    setSearch("");
    setTypeFilter("all");
    setPlanFilter("all");
    setStatusFilter("all");
    setSchoolFilter("");
    setHasPhone("all");
    setHasEmail("all");
    setIncludeEmpty(false);
    setPage(1);
    if (searchParams.get("schoolId")) {
      router.replace("/super-admin/contacts");
    }
  }

  function removeFilterChip(id: string) {
    setPage(1);
    switch (id) {
      case "search":
        setSearch("");
        break;
      case "type":
        setTypeFilter("all");
        break;
      case "plan":
        setPlanFilter("all");
        break;
      case "status":
        setStatusFilter("all");
        break;
      case "school":
        setSchoolFilter("");
        if (searchParams.get("schoolId")) {
          router.replace("/super-admin/contacts");
        }
        break;
      case "phone":
        setHasPhone("all");
        break;
      case "email":
        setHasEmail("all");
        break;
      case "includeEmpty":
        setIncludeEmpty(false);
        break;
      default:
        break;
    }
  }

  const stats = data?.stats;
  const insights = data?.insights;
  const coverage = data?.coverage;
  const schoolOptions = data?.schoolOptions ?? [];
  const total = data?.total ?? 0;
  const directoryTotal = data?.directoryTotal ?? total;
  const totalPages = data?.totalPages ?? 0;
  const pageSize = data?.pageSize ?? limit;
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(page * pageSize, total);

  const filterChipInput = useMemo(
    () => ({
      search,
      typeFilter,
      planFilter,
      statusFilter,
      schoolName: effectiveSchoolId ? activeSchoolName : "",
      hasPhone,
      hasEmail,
      includeEmpty,
    }),
    [
      search,
      typeFilter,
      planFilter,
      statusFilter,
      effectiveSchoolId,
      activeSchoolName,
      hasPhone,
      hasEmail,
      includeEmpty,
    ]
  );

  const filterChips = useMemo(
    () => buildContactsFilterChips(filterChipInput),
    [filterChipInput]
  );

  const filterSummaryItems = useMemo(
    () => buildContactsFilterSummaryItems(filterChipInput),
    [filterChipInput]
  );

  const activeFilterCount = useMemo(
    () =>
      countContactsActiveFilters({
        search,
        typeFilter,
        planFilter,
        statusFilter,
        schoolId: effectiveSchoolId,
        hasPhone,
        hasEmail,
        includeEmpty,
      }),
    [
      search,
      typeFilter,
      planFilter,
      statusFilter,
      effectiveSchoolId,
      hasPhone,
      hasEmail,
      includeEmpty,
    ]
  );

  const schoolsInFilteredSet = activeSchoolId ? 1 : (insights?.schoolsRepresented ?? 0);

  const typeTabs: { key: ContactTypeFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "admin", label: "Admins" },
    { key: "teacher", label: "Teachers" },
    { key: "parent", label: "Parents" },
  ];

  const rowActionContext = useMemo<ContactsRowActionContext>(
    () => ({
      filteredSchoolId: activeSchoolId,
      schoolName: activeSchoolName || null,
      fromIntelligence,
      intelligenceNav,
    }),
    [activeSchoolId, activeSchoolName, fromIntelligence, intelligenceNav]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <ContactsExecutiveHeader
        lastUpdated={data?.lastUpdated ?? null}
        schoolsRepresented={
          activeSchoolId ? 1 : (insights?.schoolsRepresented ?? 0)
        }
        totalContacts={stats?.total ?? 0}
        loading={loading}
        filteredSchoolName={activeSchoolId ? activeSchoolName : null}
        backHref={fromIntelligence ? intelligenceDashboardHref() : "/super-admin"}
        backLabel={fromIntelligence ? "Back to Intelligence" : "Back"}
        backLoadingLabel={fromIntelligence ? "Returning…" : "Loading…"}
      />

      {activeSchoolId ? (
        <SchoolIntelligenceContextBanner
          schoolName={
            intelligenceNav?.schoolName ||
            schoolContextPayload?.school.name ||
            schoolOptions.find((s) => s.id === activeSchoolId)?.name ||
            ""
          }
          context={schoolContextPayload?.school ?? null}
          loading={schoolContextLoading}
          showIntelligenceReturn={fromIntelligence}
          filterMode="contacts"
          onClearFilter={clearSchoolContextFilter}
          onChangeSchool={focusSchoolPicker}
        />
      ) : null}

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 xl:grid-cols-6">
        {activeFilterCount > 0 ? (
          <p className="col-span-full -mb-1 text-xs text-slate-500">
            KPI metrics reflect your active filters
          </p>
        ) : null}
        <SaKpiCard
          label="Total Contacts"
          value={loading ? "…" : (stats?.total ?? "—")}
          className="min-w-[9.5rem] shrink-0 snap-start sm:min-w-0"
        />
        <SaKpiCard
          label="Admin Contacts"
          value={loading ? "…" : (stats?.admins ?? "—")}
          className="min-w-[9.5rem] shrink-0 snap-start sm:min-w-0"
        />
        <SaKpiCard
          label="Teacher Contacts"
          value={loading ? "…" : (stats?.teachers ?? "—")}
          className="min-w-[9.5rem] shrink-0 snap-start sm:min-w-0"
        />
        <SaKpiCard
          label="Parent Contacts"
          value={loading ? "…" : (stats?.parents ?? "—")}
          className="min-w-[9.5rem] shrink-0 snap-start sm:min-w-0"
        />
        <SaKpiCard
          label="Contacts With Phone"
          value={loading ? "…" : (stats?.withPhone ?? "—")}
          className="min-w-[9.5rem] shrink-0 snap-start sm:min-w-0"
        />
        <SaKpiCard
          label="Contacts With Email"
          value={loading ? "…" : (stats?.withEmail ?? "—")}
          className="min-w-[9.5rem] shrink-0 snap-start sm:min-w-0"
        />
      </div>

      <section className="space-y-3">
        <ContactsInsightChips insights={insights} loading={loading} />
        <ContactsCoverageWidget coverage={coverage} loading={loading} />
      </section>

      <section className={saSection}>
        <ContactsDirectoryHeader
          loading={loading}
          filteredTotal={total}
          schoolsRepresented={schoolsInFilteredSet}
          activeSchoolName={activeSchoolId ? activeSchoolName : null}
        />

        <div className={cn(saDirectoryToolbar, "mt-4 gap-0 overflow-hidden p-0")}>
          <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-5 py-4 shadow-sm backdrop-blur-sm supports-[backdrop-filter]:bg-white/90">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {typeTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setTypeFilter(tab.key)}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
                      typeFilter === tab.key ? saFilterTabActive : saFilterTabInactive
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <ContactsFiltersAppliedBadge count={activeFilterCount} />
                <button
                  type="button"
                  onClick={clearFilters}
                  disabled={activeFilterCount === 0}
                  className={cn(
                    saBtnSecondarySm,
                    "bg-white",
                    activeFilterCount === 0 && "cursor-not-allowed opacity-50"
                  )}
                >
                  Reset Filters
                </button>
              </div>
            </div>

            <div className="mt-3">
              <ContactsFilterBadgesRow
                chips={filterChips}
                onRemove={removeFilterChip}
                onClearAll={clearFilters}
              />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative sm:col-span-2">
                <SearchIcon />
                <input
                  type="text"
                  placeholder="Search by name, phone, email, or school..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={saSearchInput}
                />
              </div>
              <select
                ref={schoolSelectRef}
                value={effectiveSchoolId}
                onChange={(e) => handleSchoolFilterChange(e.target.value)}
                className={cn(
                  saInput,
                  "border-slate-300",
                  effectiveSchoolId && "border-indigo-300 bg-indigo-50/40 font-medium"
                )}
              >
                <option value="">All schools</option>
                {schoolOptions.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                    {school.status === "active" ? "" : ` (${school.status})`}
                  </option>
                ))}
              </select>
              <select
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value as ContactPlanFilter)}
                className={cn(saInput, "border-slate-300")}
              >
                <option value="all">All plans</option>
                <option value="free">Free</option>
                <option value="paid">Paid</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as ContactStatusFilter)
                }
                className={cn(saInput, "border-slate-300")}
              >
                <option value="all">All statuses (excl. archived)</option>
                <option value="setup">Setup</option>
                <option value="active">Active schools only</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </select>
              <ContactsHasFilterSelect
                id="contacts-phone-filter"
                label="Phone"
                value={hasPhone}
                onChange={setHasPhone}
                options={CONTACTS_PHONE_FILTER_OPTIONS}
                tooltips={PHONE_FILTER_TOOLTIPS}
                optionLabels={PHONE_FILTER_LABELS}
              />
              <ContactsHasFilterSelect
                id="contacts-email-filter"
                label="Email"
                value={hasEmail}
                onChange={setHasEmail}
                options={CONTACTS_EMAIL_FILTER_OPTIONS}
                tooltips={EMAIL_FILTER_TOOLTIPS}
                optionLabels={EMAIL_FILTER_LABELS}
              />
              <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={includeEmpty}
                  onChange={(e) => setIncludeEmpty(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Include rows without phone or email
              </label>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-3">
              <ContactsFilterResultCounter
                loading={loading}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                filteredTotal={total}
                directoryTotal={directoryTotal}
                activeFilterCount={activeFilterCount}
              />
            </div>
          </div>

          <div className="flex flex-col gap-4 px-5 py-4">
          <ContactsQuickActions
            loading={loading}
            copyBusy={copyBusy}
            onCopyPhones={() => void copyVisiblePhones()}
            onCopyEmails={() => void copyVisibleEmails()}
            exportAllUrl={buildExportUrl("csv")}
            exportAdminsUrl={buildExportUrl("csv", "admin")}
            exportTeachersUrl={buildExportUrl("csv", "teacher")}
            exportParentsUrl={buildExportUrl("csv", "parent")}
          />

          <div className="flex flex-wrap items-center justify-end gap-2">
            <SuperAdminLoadingButton
                type="button"
                disabled={copyBusy || loading}
                loading={phoneCopy.isCopying}
                loadingLabel="Copying…"
                success={phoneCopy.isCopied}
                successLabel="Copied"
                onClick={() => void copyVisiblePhones()}
                className={saBtnSecondarySm}
              >
                Copy visible phones
              </SuperAdminLoadingButton>
              <SuperAdminLoadingButton
                type="button"
                disabled={copyBusy || loading}
                loading={emailCopy.isCopying}
                loadingLabel="Copying…"
                success={emailCopy.isCopied}
                successLabel="Copied"
                onClick={() => void copyVisibleEmails()}
                className={saBtnSecondarySm}
              >
                Copy visible emails
              </SuperAdminLoadingButton>
              <SuperAdminExportLink href={buildExportUrl("csv")} className={saBtnSecondarySm}>
                Export CSV
              </SuperAdminExportLink>
              <SuperAdminExportLink href={buildExportUrl("excel")} className={saBtnSecondarySm}>
                Export Excel
              </SuperAdminExportLink>
          </div>
          </div>
        </div>

        <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Use contacts only for official Adakaro communication, onboarding,
          support, and product updates.
        </p>

        {error ? (
          <p className="mt-4 text-sm text-red-600">{error}</p>
        ) : null}

        <div className="mt-4">
          <ContactsActiveFilterSummary
            loading={loading}
            filteredTotal={total}
            directoryTotal={directoryTotal}
            summaryItems={filterSummaryItems}
            onClearAll={clearFilters}
          />
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <p className="px-4 py-12 text-center text-sm text-slate-500">
              Loading contacts…
            </p>
          ) : total === 0 ? (
            <ContactsFilteredEmptyState
              summaryItems={filterSummaryItems}
              onClearFilters={clearFilters}
              onShowAll={clearFilters}
            />
          ) : (
            <>
              <div className="hidden max-h-[min(70vh,48rem)] overflow-auto md:block">
                <table className="w-full min-w-[56rem] text-sm">
                  <ContactsTableHeader />
                  <tbody>
                    {(data?.contacts ?? []).map((row) => (
                      <ContactTableRow
                        key={row.id}
                        row={row}
                        actionContext={rowActionContext}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-3 p-3 md:hidden">
                {(data?.contacts ?? []).map((row) => (
                  <ContactMobileCard
                    key={row.id}
                    row={row}
                    actionContext={rowActionContext}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {total > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span>Rows per page</span>
              <select
                value={limit}
                onChange={(e) =>
                  setLimit(
                    Number(e.target.value) as (typeof ROWS_PER_PAGE_OPTIONS)[number]
                  )
                }
                className={cn(saInput, "py-1.5")}
              >
                {ROWS_PER_PAGE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={saBtnSecondarySm}
              >
                Previous
              </button>
              <span className="text-sm text-slate-600">
                Page {page} of {Math.max(totalPages, 1)}
              </span>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
                className={saBtnSecondarySm}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
