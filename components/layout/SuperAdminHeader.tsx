"use client";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { NavLinkWithLoading } from "@/components/layout/nav-link-with-loading";
import { SuperAdminSchoolWorkspacePicker } from "@/components/super-admin/super-admin-school-workspace-picker";
import { SuperAdminNotificationsBell } from "@/components/super-admin/super-admin-notifications-bell";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/utils";
import {
  Activity,
  ArrowUpCircle,
  ChevronDown,
  Clock,
  ExternalLink,
  History,
  Megaphone,
  Menu,
  MessageSquare,
  Moon,
  Settings,
  Sun,
  User,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface SuperAdminHeaderProps {
  fullName: string;
  avatarUrl?: string | null;
}

interface NavDropdownItem {
  href?: string;
  label: string;
  description?: string;
  isActive: boolean;
  icon: ReactNode;
  comingSoon?: boolean;
}

type NavMenuId = "schools" | "communications";

function userInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  const t = displayName.trim();
  return t.slice(0, 2).toUpperCase() || "?";
}

const navTriggerBase =
  "inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2.5 text-[13px] font-medium transition-all duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-school-primary xl:px-3";

const navTriggerInactive =
  "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-100";

const navTriggerActive =
  "bg-slate-100/90 font-semibold text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/70 dark:bg-zinc-800/90 dark:text-white dark:ring-zinc-700/60";

const navTriggerGroupActive =
  "bg-slate-100/70 font-semibold text-slate-900 ring-1 ring-slate-200/50 dark:bg-zinc-800/70 dark:text-white dark:ring-zinc-700/40";

const dropdownPanelClass =
  "absolute z-[60] w-[17.5rem] max-w-[calc(100vw-2rem)] origin-top overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_12px_40px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.04] dark:border-zinc-700/80 dark:bg-zinc-900 dark:shadow-[0_16px_48px_rgba(0,0,0,0.45)] dark:ring-white/[0.06]";

const dropdownItemClass =
  "flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-left transition-all duration-150 ease-out focus-visible:outline-none";

const dropdownItemInteractive =
  "text-slate-700 hover:bg-slate-50 focus-visible:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-800/90 dark:focus-visible:bg-zinc-800/90";

const dropdownItemDisabled =
  "cursor-not-allowed opacity-55 dark:opacity-50";

const dropdownIconWrap =
  "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors duration-150 group-hover:bg-white group-hover:text-slate-700 dark:bg-zinc-800 dark:text-zinc-400 dark:group-hover:bg-zinc-700 dark:group-hover:text-zinc-200";

function useDropdownMotion(open: boolean) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    setVisible(false);
    const timer = window.setTimeout(() => setMounted(false), 180);
    return () => window.clearTimeout(timer);
  }, [open]);

  return { mounted, visible };
}

function NavDropdown({
  label,
  items,
  isGroupActive,
  isOpen,
  onOpenChange,
  align = "left",
}: {
  label: string;
  items: NavDropdownItem[];
  isGroupActive: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  align?: "left" | "right";
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const { mounted, visible } = useDropdownMotion(isOpen);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) close();
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [isOpen, close]);

  function renderItem(item: NavDropdownItem) {
    const content = (
      <>
        <span
          className={cn(
            dropdownIconWrap,
            item.isActive &&
              !item.comingSoon &&
              "bg-[rgb(var(--school-primary-rgb)/0.12)] text-school-primary dark:bg-[rgb(var(--school-primary-rgb)/0.18)]"
          )}
        >
          {item.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium leading-snug text-slate-800 dark:text-zinc-100">
              {item.label}
            </span>
            {item.comingSoon ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
                Coming soon
              </span>
            ) : null}
          </span>
          {item.description ? (
            <span className="mt-0.5 block text-xs leading-snug text-slate-500 dark:text-zinc-400">
              {item.description}
            </span>
          ) : null}
        </span>
      </>
    );

    if (item.comingSoon || !item.href) {
      return (
        <div
          key={item.label}
          role="menuitem"
          aria-disabled
          className={cn(dropdownItemClass, dropdownItemDisabled)}
        >
          {content}
        </div>
      );
    }

    return (
      <NavLinkWithLoading
        key={item.href}
        href={item.href}
        role="menuitem"
        loadingLabel="Loading…"
        className={cn(
          dropdownItemClass,
          dropdownItemInteractive,
          "group",
          item.isActive &&
            "bg-slate-50 dark:bg-zinc-800/90"
        )}
        onClick={close}
      >
        {content}
      </NavLinkWithLoading>
    );
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-controls={panelId}
        onClick={() => onOpenChange(!isOpen)}
        className={cn(
          navTriggerBase,
          isOpen || isGroupActive ? navTriggerGroupActive : navTriggerInactive,
          isOpen &&
            "bg-slate-100 ring-slate-200/70 dark:bg-zinc-800 dark:ring-zinc-700/60"
        )}
      >
        {label}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 opacity-60 transition-transform duration-200 ease-out",
            isOpen && "rotate-180 opacity-80"
          )}
          aria-hidden
        />
      </button>
      {mounted ? (
        <div
          id={panelId}
          role="menu"
          aria-label={label}
          className={cn(
            dropdownPanelClass,
            "left-0 top-full mt-2 transition-all duration-200 ease-out",
            align === "right" && "left-auto right-0",
            visible
              ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
              : "pointer-events-none translate-y-1 scale-[0.98] opacity-0"
          )}
        >
          <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-zinc-500">
            {label}
          </p>
          <div className="space-y-0.5">{items.map(renderItem)}</div>
        </div>
      ) : null}
    </div>
  );
}

function ThemePreferencesItem() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const label = !mounted
    ? "Theme Preferences"
    : theme === "system"
      ? `System (${resolvedTheme === "dark" ? "Dark" : "Light"})`
      : theme === "dark"
        ? "Dark mode"
        : "Light mode";

  function cycleTheme() {
    if (theme === "system") setTheme("light");
    else if (theme === "light") setTheme("dark");
    else setTheme("system");
  }

  return (
    <button
      type="button"
      role="menuitem"
      onClick={cycleTheme}
      className={cn(dropdownItemClass, dropdownItemInteractive, "group w-full")}
    >
      <span className={dropdownIconWrap}>
        {!mounted || resolvedTheme === "dark" ? (
          <Moon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        ) : (
          <Sun className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        )}
      </span>
      <span className="min-w-0 flex-1 text-left leading-snug">{label}</span>
    </button>
  );
}

function UserMenu({
  fullName,
  avatarUrl,
}: {
  fullName: string;
  avatarUrl?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const { mounted, visible } = useDropdownMotion(open);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) close();
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open, close]);

  const avatar = (
    <div className="flex h-8 w-8 shrink-0 overflow-hidden rounded-full border border-slate-200/90 bg-slate-100 shadow-sm transition-shadow duration-200 group-hover:shadow-md dark:border-zinc-600 dark:bg-zinc-800">
      {avatarUrl?.trim() ? (
        <img
          src={avatarUrl.trim()}
          alt=""
          className="h-full w-full object-cover"
          width={32}
          height={32}
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-slate-600 dark:text-zinc-300"
          aria-hidden
        >
          {userInitials(fullName)}
        </span>
      )}
    </div>
  );

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "group inline-flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-all duration-200 ease-out",
          "hover:bg-slate-100/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-school-primary",
          "dark:hover:bg-zinc-800/80",
          open && "bg-slate-100/80 dark:bg-zinc-800/80"
        )}
      >
        {avatar}
        <span className="hidden min-w-0 flex-col items-start leading-none md:flex">
          <span className="text-[13px] font-semibold text-slate-800 dark:text-zinc-100">
            Super Admin
          </span>
        </span>
        <ChevronDown
          className={cn(
            "hidden h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 ease-out md:block dark:text-zinc-500",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      {mounted ? (
        <div
          id={menuId}
          role="menu"
          className={cn(
            dropdownPanelClass,
            "right-0 top-[calc(100%+8px)] origin-top-right transition-all duration-200 ease-out",
            visible
              ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
              : "pointer-events-none -translate-y-1 scale-[0.98] opacity-0"
          )}
        >
          <div className="border-b border-slate-100 px-4 py-3 dark:border-zinc-800">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
              {fullName}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
              Platform administrator
            </p>
          </div>
          <div className="p-1.5">
            <NavLinkWithLoading
              href="/dashboard/school-settings#admin-account"
              role="menuitem"
              loadingLabel="Loading…"
              className={cn(dropdownItemClass, dropdownItemInteractive, "group")}
              onClick={close}
            >
              <span className={dropdownIconWrap}>
                <User className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </span>
              Profile
            </NavLinkWithLoading>
            <NavLinkWithLoading
              href="/dashboard/school-settings"
              role="menuitem"
              loadingLabel="Loading…"
              className={cn(dropdownItemClass, dropdownItemInteractive, "group")}
              onClick={close}
            >
              <span className={dropdownIconWrap}>
                <Settings className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </span>
              Account Settings
            </NavLinkWithLoading>
            <ThemePreferencesItem />
          </div>
          <div className="mx-2 border-t border-slate-100 dark:border-zinc-800" />
          <div className="p-1.5">
            <SignOutButton
              formClassName="w-full"
              className="block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-600 transition-colors duration-150 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SuperAdminHeader({
  fullName,
  avatarUrl = null,
}: SuperAdminHeaderProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [workspacePickerOpen, setWorkspacePickerOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<NavMenuId | null>(null);
  const { mounted: mobileMounted, visible: mobileVisible } =
    useDropdownMotion(mobileOpen);

  useEffect(() => {
    setMobileOpen(false);
    setOpenMenu(null);
  }, [pathname]);

  const isDashboard =
    pathname === "/super-admin" || pathname === "/super-admin/";
  const isAnalytics = pathname.startsWith("/super-admin/analytics");
  const isContacts = pathname.startsWith("/super-admin/contacts");
  const isUpgradeRequests = pathname.startsWith(
    "/super-admin/upgrade-requests"
  );
  const isHealthCenter = pathname.startsWith("/super-admin/watchdog");
  const isActivityLogs = pathname.startsWith("/super-admin/activity-logs");
  const isDemoRequests = pathname.startsWith("/super-admin/demo-requests");
  const isBroadcasts = pathname.startsWith("/super-admin/broadcasts");

  const isSchoolsGroupActive =
    isContacts || isUpgradeRequests || isHealthCenter || isActivityLogs;
  const isCommunicationsGroupActive = isBroadcasts || isDemoRequests;

  const iconClass = "h-4 w-4";

  const schoolsItems: NavDropdownItem[] = [
    {
      href: "/super-admin/contacts",
      label: "Contacts Center",
      description: "School contacts directory",
      isActive: isContacts,
      icon: <Users className={iconClass} strokeWidth={1.75} aria-hidden />,
    },
    {
      href: "/super-admin/upgrade-requests",
      label: "Upgrade Requests",
      description: "Plan upgrade queue",
      isActive: isUpgradeRequests,
      icon: (
        <ArrowUpCircle className={iconClass} strokeWidth={1.75} aria-hidden />
      ),
    },
    {
      href: "/super-admin/watchdog",
      label: "Health Center",
      description: "Platform health alerts",
      isActive: isHealthCenter,
      icon: <Activity className={iconClass} strokeWidth={1.75} aria-hidden />,
    },
    {
      href: "/super-admin/activity-logs",
      label: "Activity Logs",
      description: "Audit and platform events",
      isActive: isActivityLogs,
      icon: <Clock className={iconClass} strokeWidth={1.75} aria-hidden />,
    },
  ];

  const communicationsItems: NavDropdownItem[] = [
    {
      href: "/super-admin/demo-requests",
      label: "Demo Requests",
      description: "Inbound demo leads from Contact page",
      isActive: isDemoRequests,
      icon: <MessageSquare className={iconClass} strokeWidth={1.75} aria-hidden />,
    },
    {
      href: "/super-admin/broadcasts",
      label: "Broadcast Messages",
      description: "Platform-wide announcements",
      isActive: isBroadcasts,
      icon: <Megaphone className={iconClass} strokeWidth={1.75} aria-hidden />,
    },
    {
      label: "SMS Campaigns",
      description: "Bulk SMS outreach",
      isActive: false,
      comingSoon: true,
      icon: (
        <MessageSquare className={iconClass} strokeWidth={1.75} aria-hidden />
      ),
    },
    {
      label: "Message History",
      description: "Sent message archive",
      isActive: false,
      comingSoon: true,
      icon: <History className={iconClass} strokeWidth={1.75} aria-hidden />,
    },
  ];

  const mobileNavLink = (
    href: string | undefined,
    label: string,
    isActive: boolean,
    icon?: ReactNode,
    comingSoon?: boolean
  ) => {
    if (comingSoon || !href) {
      return (
        <div
          key={label}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium opacity-55"
          aria-disabled
        >
          {icon ? (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
              {icon}
            </span>
          ) : null}
          <span className="flex flex-1 items-center justify-between gap-2">
            {label}
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Soon
            </span>
          </span>
        </div>
      );
    }

    return (
      <NavLinkWithLoading
        key={href}
        href={href}
        loadingLabel="Loading…"
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
          isActive
            ? "bg-slate-100 font-semibold text-slate-900 ring-1 ring-slate-200/70 dark:bg-zinc-800 dark:text-white dark:ring-zinc-700/60"
            : "text-slate-700 hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-800/80"
        )}
        onClick={() => setMobileOpen(false)}
      >
        {icon ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
            {icon}
          </span>
        ) : null}
        {label}
      </NavLinkWithLoading>
    );
  };

  const portalButtonClass = cn(
    "inline-flex h-9 shrink-0 items-center gap-2.5 rounded-lg px-3.5 text-[13px] font-semibold text-white",
    "bg-school-primary shadow-[0_1px_2px_rgba(15,23,42,0.08),0_4px_12px_rgba(var(--school-primary-rgb),0.22)]",
    "transition-all duration-200 ease-out",
    "hover:-translate-y-px hover:shadow-[0_2px_4px_rgba(15,23,42,0.10),0_8px_20px_rgba(var(--school-primary-rgb),0.28)]",
    "active:translate-y-0 active:shadow-[0_1px_2px_rgba(15,23,42,0.08)]",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-school-primary",
    "dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)]"
  );

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/80 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-xl dark:border-zinc-800/70 dark:bg-zinc-950/75 dark:shadow-[0_1px_0_rgba(255,255,255,0.04)]">
      <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center gap-3 px-4 sm:px-6 lg:gap-4 lg:px-8">
        {/* LEFT — brand */}
        <div className="flex shrink-0 items-center">
          <NavLinkWithLoading
            href="/super-admin"
            className="group flex items-center gap-2.5 rounded-lg py-1 pr-2 transition-opacity duration-200 hover:opacity-90"
            aria-label="Adakaro Super Admin"
          >
            <Image
              src="/brand/logo-icon.svg"
              alt="Adakaro"
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 transition-transform duration-200 group-hover:scale-[1.02]"
            />
            <span className="hidden text-[15px] font-bold tracking-tight text-slate-900 sm:inline dark:text-white">
              Adakaro
            </span>
          </NavLinkWithLoading>
        </div>

        {/* CENTER — primary navigation */}
        <nav
          className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 lg:flex xl:gap-1"
          aria-label="Super admin"
        >
          <NavLinkWithLoading
            href="/super-admin"
            loadingLabel="Loading…"
            className={cn(
              navTriggerBase,
              isDashboard ? navTriggerActive : navTriggerInactive
            )}
          >
            Dashboard
          </NavLinkWithLoading>
          <NavLinkWithLoading
            href="/super-admin/analytics"
            loadingLabel="Loading…"
            className={cn(
              navTriggerBase,
              isAnalytics ? navTriggerActive : navTriggerInactive
            )}
          >
            Analytics
          </NavLinkWithLoading>
          <NavDropdown
            label="Schools"
            items={schoolsItems}
            isGroupActive={isSchoolsGroupActive}
            isOpen={openMenu === "schools"}
            onOpenChange={(next) => setOpenMenu(next ? "schools" : null)}
            align="left"
          />
          <NavDropdown
            label="Communications"
            items={communicationsItems}
            isGroupActive={isCommunicationsGroupActive}
            isOpen={openMenu === "communications"}
            onOpenChange={(next) =>
              setOpenMenu(next ? "communications" : null)
            }
            align="right"
          />
        </nav>

        {/* RIGHT — executive actions */}
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-2.5 lg:ml-6 lg:gap-3 lg:border-l lg:border-slate-200/70 lg:pl-6 dark:lg:border-zinc-800/80">
          <button
            type="button"
            onClick={() => setWorkspacePickerOpen(true)}
            className={cn(portalButtonClass, "hidden sm:inline-flex")}
          >
            <ExternalLink
              className="h-4 w-4 shrink-0 opacity-90"
              strokeWidth={1.75}
              aria-hidden
            />
            <span className="hidden xl:inline">Open School Workspace</span>
            <span className="xl:hidden">School</span>
          </button>

          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          <SuperAdminNotificationsBell />

          <UserMenu fullName={fullName} avatarUrl={avatarUrl} />

          <button
            type="button"
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200/80 text-slate-700",
              "transition-all duration-200 ease-out hover:bg-slate-100/80",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-school-primary",
              "lg:hidden dark:border-zinc-700/80 dark:text-zinc-200 dark:hover:bg-zinc-800/80"
            )}
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-controls="super-admin-mobile-nav"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            ) : (
              <Menu className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            )}
          </button>
        </div>
      </div>

      {mobileMounted ? (
        <div
          id="super-admin-mobile-nav"
          className={cn(
            "overflow-hidden border-t border-slate-200/70 bg-white/95 backdrop-blur-xl transition-all duration-200 ease-out lg:hidden dark:border-zinc-800/70 dark:bg-zinc-950/95",
            mobileVisible ? "max-h-[80vh] opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <nav
            className="flex flex-col gap-1 px-4 py-4"
            aria-label="Super admin mobile"
          >
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                setWorkspacePickerOpen(true);
              }}
              className={cn(portalButtonClass, "mb-2 w-full justify-center sm:hidden")}
            >
              <ExternalLink className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              Open School Workspace
            </button>

            {mobileNavLink("/super-admin", "Dashboard", isDashboard)}
            {mobileNavLink("/super-admin/analytics", "Analytics", isAnalytics)}

            <p className="mt-3 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-zinc-500">
              Schools
            </p>
            {schoolsItems.map((item) =>
              mobileNavLink(
                item.href,
                item.label,
                item.isActive,
                item.icon,
                item.comingSoon
              )
            )}

            <p className="mt-3 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-zinc-500">
              Communications
            </p>
            {communicationsItems.map((item) =>
              mobileNavLink(
                item.href,
                item.label,
                item.isActive,
                item.icon,
                item.comingSoon
              )
            )}

            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-zinc-800">
              <span className="px-3 text-xs font-medium text-slate-500 dark:text-zinc-400">
                Appearance
              </span>
              <ThemeToggle />
            </div>
          </nav>
        </div>
      ) : null}

      <SuperAdminSchoolWorkspacePicker
        open={workspacePickerOpen}
        onClose={() => setWorkspacePickerOpen(false)}
      />
    </header>
  );
}
