"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Building2,
  Check,
  ChevronDown,
  CircleHelp,
  GraduationCap,
  KeyRound,
  Layers,
  LayoutGrid,
  LifeBuoy,
  Megaphone,
  Plug,
  Rocket,
  School,
  Search,
  Shield,
  Sparkles,
  Tags,
  TrendingUp,
  UserCircle,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import {
  buildGroupedCategoryList,
  filterGroupedCategoryList,
  getCategoryGroupLabel,
  getKnowledgeCategoryIconKey,
  rememberLastKnowledgeCategory,
  selectableOptionsFromGrouped,
  type GroupedCategoryListItem,
  type KnowledgeCategoryIconKey,
} from "@/lib/ai-training/knowledge-categories";
import { cn } from "@/lib/utils";

const DROPDOWN_MAX_HEIGHT_PX = 360;
const VIEWPORT_PADDING_PX = 8;

/** Search aliases — UI-only; taxonomy unchanged. */
const CATEGORY_SEARCH_ALIASES: Record<string, readonly string[]> = {
  support: ["Technical Support", "Troubleshooting", "Frequently Asked Questions"],
  help: ["Technical Support", "Troubleshooting", "Frequently Asked Questions", "Best Practices"],
  faq: ["Frequently Asked Questions"],
  student: ["Student Management", "Student Streaming", "Classes & Streams", "Admissions"],
  finance: ["Finance"],
  admin: ["School Administration", "Security & Roles", "User Accounts", "Permissions"],
  security: ["Security & Roles", "User Accounts", "Permissions"],
  ai: ["AI Copilot"],
  copilot: ["AI Copilot"],
  parent: ["Parent Portal"],
  teacher: ["Teachers & Staff"],
  staff: ["Teachers & Staff"],
  syllabus: ["Curriculum & Syllabus"],
  curriculum: ["Curriculum & Syllabus"],
  report: ["Report Cards"],
  attendance: ["Attendance"],
  pricing: ["Pricing"],
  integration: ["Integrations"],
  notification: ["Notifications"],
  onboarding: ["Getting Started"],
  started: ["Getting Started"],
};

const ICONS: Record<KnowledgeCategoryIconKey, LucideIcon> = {
  about: Building2,
  ai: Bot,
  start: Rocket,
  pricing: Wallet,
  students: Users,
  admissions: GraduationCap,
  classes: LayoutGrid,
  teachers: UserCircle,
  attendance: BookOpen,
  reports: BarChart3,
  finance: Wallet,
  parents: Users,
  communication: Megaphone,
  curriculum: Layers,
  promotions: TrendingUp,
  streaming: Layers,
  security: Shield,
  analytics: BarChart3,
  integrations: Plug,
  notifications: Bell,
  accounts: UserCircle,
  permissions: KeyRound,
  administration: School,
  support: LifeBuoy,
  troubleshooting: Wrench,
  practices: Sparkles,
  faq: CircleHelp,
  updates: Tags,
  general: Tags,
};

function CategoryIcon({ category, className }: { category: string; className?: string }) {
  if (!category) return <Tags className={className} aria-hidden />;
  const Icon = ICONS[getKnowledgeCategoryIconKey(category)] ?? Tags;
  return <Icon className={className} aria-hidden />;
}

function categoryMatchesSearch(
  category: string,
  groupLabel: string,
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (category.toLowerCase().includes(q)) return true;
  if (groupLabel.toLowerCase().includes(q)) return true;

  for (const [alias, categories] of Object.entries(CATEGORY_SEARCH_ALIASES)) {
    const aliasHit = alias.includes(q) || q.includes(alias);
    if (aliasHit && categories.includes(category)) return true;
  }

  return false;
}

function filterGroupedCategoryListWithAliases(
  items: GroupedCategoryListItem[],
  query: string,
  allowEmpty?: boolean,
  emptyLabel?: string
): GroupedCategoryListItem[] {
  const q = query.trim();
  if (!q) {
    return filterGroupedCategoryList(items, "", allowEmpty, emptyLabel);
  }

  const base = filterGroupedCategoryList(items, q, allowEmpty, emptyLabel);
  const matchedValues = new Set(
    base
      .filter((item): item is Extract<GroupedCategoryListItem, { type: "option" }> => item.type === "option")
      .map((item) => item.value)
  );

  const result: GroupedCategoryListItem[] = [];
  if (allowEmpty && emptyLabel && emptyLabel.toLowerCase().includes(q.toLowerCase())) {
    result.push({ type: "option", value: "", groupLabel: "All" });
  }

  let index = 0;
  while (index < items.length) {
    const item = items[index];
    if (item.type !== "header") {
      index++;
      continue;
    }

    const header = item;
    const matchedOptions: GroupedCategoryListItem[] = [];
    index++;

    while (index < items.length && items[index]?.type === "option") {
      const option = items[index] as Extract<GroupedCategoryListItem, { type: "option" }>;
      const alreadyMatched = matchedValues.has(option.value);
      const aliasMatched = categoryMatchesSearch(option.value, option.groupLabel, q);
      if (alreadyMatched || aliasMatched) {
        matchedOptions.push(option);
        matchedValues.add(option.value);
      }
      index++;
    }

    if (matchedOptions.length > 0) {
      result.push(header, ...matchedOptions);
    }
  }

  return result;
}

export interface KnowledgeCategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  extraCategories?: string[];
  allowEmpty?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
  placeholder?: string;
  rememberSelection?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
}

interface DropdownPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: "bottom" | "top";
}

export function KnowledgeCategorySelect({
  value,
  onChange,
  extraCategories = [],
  allowEmpty = false,
  emptyLabel = "All categories",
  disabled = false,
  placeholder = "Search categories or groups…",
  rememberSelection = false,
  className,
  id,
  "aria-label": ariaLabel = "Category",
}: KnowledgeCategorySelectProps) {
  const autoId = useId();
  const listboxId = `${autoId}-listbox`;
  const searchInputId = `${autoId}-search`;
  const triggerId = id ?? `${autoId}-trigger`;

  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const groupedItems = useMemo(
    () => buildGroupedCategoryList(extraCategories),
    [extraCategories]
  );

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<DropdownPosition | null>(null);

  const filteredItems = useMemo(
    () =>
      filterGroupedCategoryListWithAliases(groupedItems, query, allowEmpty, emptyLabel),
    [groupedItems, query, allowEmpty, emptyLabel]
  );

  const selectable = useMemo(
    () => selectableOptionsFromGrouped(filteredItems),
    [filteredItems]
  );

  const selectedGroup = value ? getCategoryGroupLabel(value) : null;

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const trigger = rootRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PADDING_PX;
    const spaceAbove = rect.top - VIEWPORT_PADDING_PX;
    const placement =
      spaceBelow < DROPDOWN_MAX_HEIGHT_PX && spaceAbove > spaceBelow ? "top" : "bottom";
    const available = placement === "bottom" ? spaceBelow : spaceAbove;
    const maxHeight = Math.min(DROPDOWN_MAX_HEIGHT_PX, Math.max(160, available));

    setPosition({
      top: placement === "bottom" ? rect.bottom + 4 : rect.top - 4,
      left: rect.left,
      width: rect.width,
      maxHeight,
      placement,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, query, updatePosition]);

  useEffect(() => {
    if (!open) return;

    const onScrollOrResize = () => updatePosition();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);

    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = optionRefs.current.get(highlight);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlight, open, filteredItems]);

  useEffect(() => {
    if (!open) return;

    const onDocPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
      setQuery("");
    };

    document.addEventListener("mousedown", onDocPointer);
    return () => document.removeEventListener("mousedown", onDocPointer);
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const selectValue = useCallback(
    (next: string) => {
      onChange(next);
      if (rememberSelection && next) rememberLastKnowledgeCategory(next);
      close();
    },
    [onChange, rememberSelection, close]
  );

  const openDropdown = useCallback(() => {
    if (disabled) return;
    setOpen(true);
  }, [disabled]);

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      openDropdown();
      return;
    }

    if (e.key === "Escape" && open) {
      e.preventDefault();
      close();
    }
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      rootRef.current?.querySelector("button")?.focus();
      return;
    }

    if (e.key === "Tab") {
      close();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((i) => Math.min(i + 1, Math.max(0, selectable.length - 1)));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((i) => Math.max(i - 1, 0));
      return;
    }

    if (e.key === "Enter" && selectable[highlight]) {
      e.preventDefault();
      selectValue(selectable[highlight].value);
    }
  };

  const dropdownPanel =
    open && position && mounted
      ? createPortal(
          <div
            ref={panelRef}
            className="fixed z-[9999]"
            style={{
              left: position.left,
              width: position.width,
              top: position.placement === "bottom" ? position.top : undefined,
              bottom:
                position.placement === "top"
                  ? window.innerHeight - position.top
                  : undefined,
            }}
            onWheel={(e) => e.stopPropagation()}
          >
            <div
              className={cn(
                "overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-xl ring-1 ring-black/5",
                "animate-in fade-in-0 zoom-in-95 duration-150"
              )}
              role="presentation"
            >
              <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                <input
                  ref={searchRef}
                  id={searchInputId}
                  type="text"
                  role="combobox"
                  aria-expanded={open}
                  aria-controls={listboxId}
                  aria-autocomplete="list"
                  aria-activedescendant={
                    selectable[highlight]
                      ? `${listboxId}-option-${highlight}`
                      : undefined
                  }
                  aria-label={`${ariaLabel} search`}
                  value={query}
                  placeholder={placeholder}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onSearchKeyDown}
                  className="min-w-0 flex-1 border-0 bg-transparent py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0"
                />
              </div>

              <div
                ref={listRef}
                id={listboxId}
                role="listbox"
                aria-label={ariaLabel}
                className={cn(
                  "overflow-y-auto overscroll-contain py-1",
                  "touch-pan-y [-webkit-overflow-scrolling:touch]",
                  "[scrollbar-gutter:stable] [scrollbar-width:thin] [scrollbar-color:rgb(203_213_225)_transparent]",
                  "[&::-webkit-scrollbar]:w-2",
                  "[&::-webkit-scrollbar-track]:bg-transparent",
                  "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300",
                  "[&::-webkit-scrollbar-thumb:hover]:bg-slate-400"
                )}
                style={{ maxHeight: position.maxHeight }}
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                {filteredItems.length > 0 ? (
                  filteredItems.map((item) => {
                    if (item.type === "header") {
                      return (
                        <div
                          key={`header-${item.id}`}
                          role="presentation"
                          className="sticky top-0 z-10 border-b border-slate-100/80 bg-slate-50/95 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 backdrop-blur-sm"
                        >
                          {item.label}
                        </div>
                      );
                    }

                    const selectableIndex = selectable.findIndex(
                      (s) => s.value === item.value
                    );
                    const label =
                      allowEmpty && item.value === "" ? emptyLabel : item.value;
                    const selected = item.value === value;
                    const highlighted = selectableIndex === highlight;

                    return (
                      <div
                        key={item.value || "__empty__"}
                        ref={(el) => {
                          if (el && selectableIndex >= 0) {
                            optionRefs.current.set(selectableIndex, el);
                          }
                        }}
                        id={
                          selectableIndex >= 0
                            ? `${listboxId}-option-${selectableIndex}`
                            : undefined
                        }
                        role="option"
                        aria-selected={selected}
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm transition-colors duration-100",
                          highlighted && "bg-violet-50",
                          selected && "bg-violet-50/70 font-medium text-violet-800",
                          !selected && !highlighted && "text-slate-700 hover:bg-slate-50"
                        )}
                        onMouseEnter={() => {
                          if (selectableIndex >= 0) setHighlight(selectableIndex);
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectValue(item.value);
                        }}
                      >
                        {item.value ? (
                          <CategoryIcon
                            category={item.value}
                            className="h-4 w-4 shrink-0 text-violet-500"
                          />
                        ) : (
                          <Tags className="h-4 w-4 shrink-0 text-slate-400" />
                        )}
                        <span className="min-w-0 flex-1 truncate">{label}</span>
                        {selected ? (
                          <Check className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <p className="px-3 py-6 text-center text-sm text-slate-500">
                    No matching categories
                  </p>
                )}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div ref={rootRef} className={cn("relative", className)}>
        <button
          type="button"
          id={triggerId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-label={ariaLabel}
          disabled={disabled}
          onClick={() => (open ? close() : openDropdown())}
          onKeyDown={onTriggerKeyDown}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg border border-slate-200/90 bg-white/90 px-3 py-2 text-left shadow-sm transition-all duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-1",
            open && "border-violet-300 ring-2 ring-violet-100",
            disabled && "cursor-not-allowed opacity-60"
          )}
        >
          {value ? (
            <CategoryIcon category={value} className="h-4 w-4 shrink-0 text-violet-600" />
          ) : (
            <Tags className="h-4 w-4 shrink-0 text-slate-400" />
          )}
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                "block truncate text-sm",
                value ? "font-medium text-slate-900" : "text-slate-400"
              )}
            >
              {value || (allowEmpty ? emptyLabel : placeholder)}
            </span>
            {value && selectedGroup ? (
              <span className="block truncate text-[10px] text-slate-400">{selectedGroup}</span>
            ) : null}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200",
              open && "rotate-180"
            )}
            aria-hidden
          />
        </button>
      </div>

      {dropdownPanel}
    </>
  );
}

export { CategoryIcon };
