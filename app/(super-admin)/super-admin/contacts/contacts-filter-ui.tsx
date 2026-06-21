"use client";

import type {
  ContactHasFilter,
  ContactPlanFilter,
  ContactStatusFilter,
  ContactTypeFilter,
} from "@/lib/super-admin/contacts-types";
import { schoolLifecycleStatusLabel } from "@/lib/super-admin/school-lifecycle";
import {
  saBtnPrimarySm,
  saBtnSecondarySm,
  saChipCalm,
  saInput,
  SaTooltip,
} from "@/components/super-admin/super-admin-dashboard-ui";
import { cn } from "@/lib/utils";
import { HelpCircle, Search, X } from "lucide-react";

export interface ContactsFilterChip {
  id: string;
  label: string;
}

export interface ContactsFilterSummaryItem {
  id: string;
  label: string;
}

const PHONE_FILTER_LABELS: Record<ContactHasFilter, string> = {
  all: "All Contacts",
  yes: "Has Phone Number",
  no: "Missing Phone Number",
};

const EMAIL_FILTER_LABELS: Record<ContactHasFilter, string> = {
  all: "All Contacts",
  yes: "Has Email Address",
  no: "Missing Email Address",
};

const PHONE_FILTER_TOOLTIPS: Record<Exclude<ContactHasFilter, "all">, string> = {
  yes: "Shows contacts that have a valid phone number saved.",
  no: "Shows contacts that require phone information to be completed.",
};

const EMAIL_FILTER_TOOLTIPS: Record<Exclude<ContactHasFilter, "all">, string> = {
  yes: "Shows contacts that have an email address saved.",
  no: "Shows contacts that require email information to be completed.",
};

export function contactsPhoneFilterLabel(value: ContactHasFilter): string {
  return PHONE_FILTER_LABELS[value];
}

export function contactsEmailFilterLabel(value: ContactHasFilter): string {
  return EMAIL_FILTER_LABELS[value];
}

export function buildContactsFilterChips(input: {
  search: string;
  typeFilter: ContactTypeFilter;
  planFilter: ContactPlanFilter;
  statusFilter: ContactStatusFilter;
  schoolName: string;
  hasPhone: ContactHasFilter;
  hasEmail: ContactHasFilter;
  includeEmpty: boolean;
}): ContactsFilterChip[] {
  const chips: ContactsFilterChip[] = [];

  if (input.search.trim()) {
    chips.push({
      id: "search",
      label: `Search: ${input.search.trim()}`,
    });
  }
  if (input.typeFilter !== "all") {
    chips.push({
      id: "type",
      label: `Role: ${input.typeFilter === "admin" ? "Admins" : input.typeFilter === "teacher" ? "Teachers" : "Parents"}`,
    });
  }
  if (input.schoolName) {
    chips.push({ id: "school", label: `School: ${input.schoolName}` });
  }
  if (input.planFilter !== "all") {
    chips.push({
      id: "plan",
      label: `Plan: ${input.planFilter === "free" ? "Free" : "Paid"}`,
    });
  }
  if (input.statusFilter !== "all") {
    chips.push({
      id: "status",
      label: `Status: ${
        input.statusFilter === "active"
          ? "Active schools only"
          : schoolLifecycleStatusLabel(input.statusFilter)
      }`,
    });
  }
  if (input.hasPhone !== "all") {
    chips.push({
      id: "phone",
      label: `Phone: ${PHONE_FILTER_LABELS[input.hasPhone]}`,
    });
  }
  if (input.hasEmail !== "all") {
    chips.push({
      id: "email",
      label: `Email: ${EMAIL_FILTER_LABELS[input.hasEmail]}`,
    });
  }
  if (input.includeEmpty) {
    chips.push({ id: "includeEmpty", label: "Including empty rows" });
  }

  return chips;
}

export function buildContactsFilterSummaryItems(input: {
  search: string;
  typeFilter: ContactTypeFilter;
  planFilter: ContactPlanFilter;
  statusFilter: ContactStatusFilter;
  schoolName: string;
  hasPhone: ContactHasFilter;
  hasEmail: ContactHasFilter;
  includeEmpty: boolean;
}): ContactsFilterSummaryItem[] {
  const items: ContactsFilterSummaryItem[] = [];

  if (input.search.trim()) {
    items.push({ id: "search", label: `Search: ${input.search.trim()}` });
  }
  if (input.typeFilter !== "all") {
    const role =
      input.typeFilter === "admin"
        ? "Admins"
        : input.typeFilter === "teacher"
          ? "Teachers"
          : "Parents";
    items.push({ id: "type", label: `Role: ${role}` });
  }
  if (input.schoolName) {
    items.push({ id: "school", label: `School: ${input.schoolName}` });
  }
  if (input.planFilter !== "all") {
    items.push({
      id: "plan",
      label: `Plan: ${input.planFilter === "free" ? "Free" : "Paid"}`,
    });
  }
  if (input.statusFilter !== "all") {
    items.push({
      id: "status",
      label: `Status: ${
        input.statusFilter === "active"
          ? "Active schools only"
          : schoolLifecycleStatusLabel(input.statusFilter)
      }`,
    });
  }
  if (input.hasPhone !== "all") {
    items.push({
      id: "phone",
      label: `Phone: ${PHONE_FILTER_LABELS[input.hasPhone]}`,
    });
  }
  if (input.hasEmail !== "all") {
    items.push({
      id: "email",
      label: `Email: ${EMAIL_FILTER_LABELS[input.hasEmail]}`,
    });
  }
  if (input.includeEmpty) {
    items.push({ id: "includeEmpty", label: "Including empty rows" });
  }

  return items;
}

export function countContactsActiveFilters(input: {
  search: string;
  typeFilter: ContactTypeFilter;
  planFilter: ContactPlanFilter;
  statusFilter: ContactStatusFilter;
  schoolId: string;
  hasPhone: ContactHasFilter;
  hasEmail: ContactHasFilter;
  includeEmpty: boolean;
}): number {
  let count = 0;
  if (input.search.trim()) count++;
  if (input.typeFilter !== "all") count++;
  if (input.planFilter !== "all") count++;
  if (input.statusFilter !== "all") count++;
  if (input.schoolId) count++;
  if (input.hasPhone !== "all") count++;
  if (input.hasEmail !== "all") count++;
  if (input.includeEmpty) count++;
  return count;
}

export function ContactsDirectoryHeader({
  loading,
  filteredTotal,
  schoolsRepresented,
  activeSchoolName,
}: {
  loading: boolean;
  filteredTotal: number;
  schoolsRepresented: number;
  activeSchoolName?: string | null;
}) {
  const countLabel = loading
    ? null
    : filteredTotal === 1
      ? "Showing 1 contact"
      : `Showing ${filteredTotal.toLocaleString()} contacts`;

  const contextLabel = loading
    ? "Loading directory summary…"
    : activeSchoolName
      ? `from ${activeSchoolName}.`
      : `across ${schoolsRepresented.toLocaleString()} school${schoolsRepresented === 1 ? "" : "s"}.`;

  return (
    <div className="space-y-1">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">
        Directory
      </h2>
      <p className="text-sm text-slate-600">Official school contact directory.</p>
      <p className="text-sm font-medium text-slate-700">
        {countLabel ? (
          <>
            {countLabel}{" "}
            <span className="font-normal text-slate-600">{contextLabel}</span>
          </>
        ) : (
          <span className="font-normal text-slate-600">{contextLabel}</span>
        )}
      </p>
    </div>
  );
}

export function ContactsFiltersAppliedBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200/80 transition-all duration-200 animate-in fade-in">
      Filters Applied ({count})
    </span>
  );
}

export function ContactsFilterBadgesRow({
  chips,
  onRemove,
  onClearAll,
}: {
  chips: ContactsFilterChip[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
}) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={() => onRemove(chip.id)}
          className={cn(
            saChipCalm,
            "h-7 max-w-[16rem] gap-1.5 bg-indigo-50 pr-1.5 text-indigo-900 ring-indigo-200/80 transition-colors hover:bg-indigo-100"
          )}
          title={`Remove ${chip.label}`}
        >
          <span className="truncate">{chip.label}</span>
          <X className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
        </button>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-800"
      >
        Clear all
      </button>
    </div>
  );
}

export function ContactsFilterResultCounter({
  loading,
  rangeStart,
  rangeEnd,
  filteredTotal,
  directoryTotal,
  activeFilterCount,
}: {
  loading: boolean;
  rangeStart: number;
  rangeEnd: number;
  filteredTotal: number;
  directoryTotal: number;
  activeFilterCount: number;
}) {
  if (loading) {
    return (
      <p className="text-sm text-slate-500">Calculating filter results…</p>
    );
  }

  const hasFilters = activeFilterCount > 0;
  const isSubset = hasFilters && filteredTotal < directoryTotal;

  let text: string;
  if (filteredTotal === 0) {
    text = isSubset
      ? `No contacts match your filters (${directoryTotal.toLocaleString()} in full directory)`
      : "No contacts in directory";
  } else if (filteredTotal <= 1) {
    text = isSubset
      ? `Showing ${filteredTotal} of ${directoryTotal.toLocaleString()} contacts`
      : "Showing 1 contact";
  } else if (rangeEnd > rangeStart) {
    text = isSubset
      ? `Showing ${rangeStart.toLocaleString()}–${rangeEnd.toLocaleString()} of ${filteredTotal.toLocaleString()} matching contacts (${directoryTotal.toLocaleString()} in directory)`
      : `Showing ${rangeStart.toLocaleString()}–${rangeEnd.toLocaleString()} of ${filteredTotal.toLocaleString()} contacts`;
  } else {
    text = isSubset
      ? `Showing ${filteredTotal.toLocaleString()} of ${directoryTotal.toLocaleString()} contacts`
      : `Showing ${filteredTotal.toLocaleString()} contacts`;
  }

  return (
    <p className="text-sm font-medium text-slate-700 transition-opacity duration-200">
      {text}
    </p>
  );
}

export function ContactsActiveFilterSummary({
  loading,
  filteredTotal,
  directoryTotal,
  summaryItems,
  onClearAll,
}: {
  loading: boolean;
  filteredTotal: number;
  directoryTotal: number;
  summaryItems: ContactsFilterSummaryItem[];
  onClearAll: () => void;
}) {
  const hasFilters = summaryItems.length > 0;
  const isSubset = hasFilters && filteredTotal < directoryTotal;

  const headline = loading
    ? "Loading filter summary…"
    : hasFilters
      ? isSubset
        ? `Showing ${filteredTotal.toLocaleString()} of ${directoryTotal.toLocaleString()} contacts`
        : filteredTotal === 1
          ? "Showing 1 contact"
          : `Showing ${filteredTotal.toLocaleString()} contacts`
      : filteredTotal === 1
        ? "Showing 1 contact"
        : `Showing ${filteredTotal.toLocaleString()} contacts`;

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-gradient-to-br from-white to-indigo-50/30 px-4 py-3 shadow-sm transition-all duration-300",
        hasFilters
          ? "border-indigo-200/80 animate-in fade-in slide-in-from-top-1"
          : "opacity-100"
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-semibold text-slate-900">{headline}</p>
          {hasFilters ? (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Active filters
              </p>
              <ul className="space-y-1">
                {summaryItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-2 text-sm text-slate-700"
                  >
                    <span className="mt-0.5 text-emerald-600" aria-hidden>
                      ✓
                    </span>
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No filters applied</p>
          )}
        </div>
        {hasFilters ? (
          <button
            type="button"
            onClick={onClearAll}
            className={cn(saBtnSecondarySm, "shrink-0 bg-white")}
          >
            Clear All Filters
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ContactsHasFilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  tooltips,
  optionLabels,
}: {
  id: string;
  label: string;
  value: ContactHasFilter;
  onChange: (value: ContactHasFilter) => void;
  options: ContactHasFilter[];
  tooltips: Record<Exclude<ContactHasFilter, "all">, string>;
  optionLabels: Record<ContactHasFilter, string>;
}) {
  const tooltipText =
    value === "all"
      ? `Filter contacts by whether a ${label.toLowerCase()} is on file.`
      : tooltips[value];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <label htmlFor={id} className="text-xs font-medium text-slate-600">
          {label}
        </label>
        <SaTooltip content={tooltipText}>
          <HelpCircle className="h-3.5 w-3.5 text-slate-400" aria-hidden />
        </SaTooltip>
      </div>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as ContactHasFilter)}
        className={cn(
          saInput,
          "w-full border-slate-300",
          value !== "all" && "border-indigo-300 bg-indigo-50/40 font-medium"
        )}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabels[option]}
          </option>
        ))}
      </select>
    </div>
  );
}

export const CONTACTS_PHONE_FILTER_OPTIONS: ContactHasFilter[] = [
  "all",
  "yes",
  "no",
];

export const CONTACTS_EMAIL_FILTER_OPTIONS: ContactHasFilter[] = [
  "all",
  "yes",
  "no",
];

export {
  PHONE_FILTER_LABELS,
  EMAIL_FILTER_LABELS,
  PHONE_FILTER_TOOLTIPS,
  EMAIL_FILTER_TOOLTIPS,
};

export function ContactsFilteredEmptyState({
  summaryItems,
  onClearFilters,
  onShowAll,
}: {
  summaryItems: ContactsFilterSummaryItem[];
  onClearFilters: () => void;
  onShowAll: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 ring-1 ring-indigo-100">
        <Search className="h-8 w-8" strokeWidth={1.5} aria-hidden />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-slate-900">
        No contacts match the selected filters
      </h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
        Try adjusting your filters or clear them to view more contacts.
      </p>

      {summaryItems.length > 0 ? (
        <div className="mt-6 w-full max-w-sm rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Current filters
          </p>
          <ul className="mt-2 space-y-1.5">
            {summaryItems.map((item) => (
              <li key={item.id} className="text-sm text-slate-700">
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={onClearFilters} className={saBtnPrimarySm}>
          Clear Filters
        </button>
        <button type="button" onClick={onShowAll} className={saBtnSecondarySm}>
          Show All Contacts
        </button>
      </div>
    </div>
  );
}
