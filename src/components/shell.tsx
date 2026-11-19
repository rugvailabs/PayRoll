"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bell,
  Briefcase,
  Building2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Hourglass,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Plus,
  Receipt,
  Search,
  Settings,
  UserCircle,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/components/ui";
import { APP_NAME } from "@/lib/brand";
import { logoutAction } from "@/app/(auth)/actions";

const ICONS = {
  dashboard: LayoutDashboard,
  employees: Users,
  clients: Building2,
  placements: Briefcase,
  timesheets: Clock,
  invoices: FileText,
  receivables: Hourglass,
  payroll: Wallet,
  payslips: Receipt,
  notifications: Bell,
  emails: Mail,
  settings: Settings,
  profile: UserCircle,
} as const;

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number };
export type NavGroup = { title?: string; items: NavItem[] };
export type QuickLink = { href: string; label: string };

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOutside: () => void) {
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [ref, onOutside]);
}

function Dropdown({ trigger, children, align = "right", width = "w-60" }: { trigger: ReactNode; children: ReactNode; align?: "left" | "right"; width?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <div
          className={cn(
            "absolute z-40 mt-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_32px_-8px_rgba(16,24,40,0.18)]",
            width,
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function initials(s: string) {
  return s.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

export function AppShell({
  orgName,
  userName,
  userEmail,
  roleLabel,
  nav,
  quickLinks,
  unread,
  children,
  profileHref = "/profile",
  notificationsHref = "/notifications",
  portalLabel,
  searchHref,
}: {
  orgName: string;
  userName: string;
  userEmail: string;
  roleLabel: string;
  nav: NavGroup[];
  quickLinks: QuickLink[][];
  unread: number;
  children: ReactNode;
  profileHref?: string;
  notificationsHref?: string;
  portalLabel?: string;
  /** When set, shows the global search box that submits to this path with ?q= */
  searchHref?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => setMobileOpen(false), [pathname]);

  // Highlight the most specific nav item that matches the current path.
  const allItems = nav.flatMap((g) => g.items.map((i) => ({ ...i, group: g.title })));
  const activeItem = allItems
    .filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];

  const sidebar = (
    <nav className="flex h-full flex-col border-r border-white/5 bg-ink-950 text-slate-400">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
          {APP_NAME.charAt(0)}
        </span>
        <span className="text-[15px] font-semibold tracking-tight text-white">{APP_NAME}</span>
      </div>

      <div className="mx-3 mb-2 flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/10 text-xs font-semibold text-white">
          {initials(orgName)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium text-white">{orgName}</span>
          <span className="block truncate text-[11px] text-slate-500">{portalLabel ?? "Organization"}</span>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {nav.map((g, gi) => (
          <div key={gi} className="mt-5 first:mt-3">
            {g.title && <p className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500">{g.title}</p>}
            <div className="space-y-0.5">
              {g.items.map((item) => {
                const Icon = ICONS[item.icon];
                const active = item.href === activeItem?.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group relative flex h-9 items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium transition",
                      active ? "bg-white/[0.08] text-white" : "hover:bg-white/[0.04] hover:text-slate-200",
                    )}
                  >
                    {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-brand-500" />}
                    <Icon size={17} strokeWidth={1.9} className={active ? "text-brand-300" : "text-slate-500 group-hover:text-slate-300"} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {!!item.badge && (
                      <span className="min-w-5 rounded-full bg-brand-600 px-1.5 text-center text-[11px] font-semibold leading-5 text-white tabular-nums">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/5 p-3">
        <Link href={profileHref} className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-white/[0.04]">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600/30 text-xs font-semibold text-brand-200">
            {initials(userName)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-white">{userName}</span>
            <span className="block truncate text-[11px] text-slate-500">{roleLabel}</span>
          </span>
        </Link>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64">{sidebar}</aside>
          <button className="absolute left-[16.75rem] top-4 rounded-lg bg-white p-1.5 shadow" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>

          <div className="hidden min-w-0 items-center gap-1.5 text-[13px] md:flex">
            <span className="text-slate-400">{activeItem?.group ?? "Home"}</span>
            <ChevronRight size={14} className="text-slate-300" />
            <span className="truncate font-medium text-slate-800">{activeItem?.label ?? ""}</span>
          </div>

          <div className="flex-1" />

          {searchHref && (
            <form
              className="relative hidden w-72 sm:block"
              onSubmit={(e) => {
                e.preventDefault();
                const q = new FormData(e.currentTarget).get("q")?.toString().trim();
                if (q) router.push(`${searchHref}?q=${encodeURIComponent(q)}`);
              }}
            >
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                name="q"
                placeholder="Search employees, clients, invoices…"
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px] text-slate-900 placeholder:text-slate-400 transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-100"
              />
            </form>
          )}

          {quickLinks.length > 0 && (
            <Dropdown
              width="w-56"
              trigger={
                <button className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white shadow-[0_1px_2px_rgba(16,24,40,0.12),inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:bg-brand-700">
                  <Plus size={16} /> <span className="hidden sm:inline">New</span>
                </button>
              }
            >
              {quickLinks.map((group, i) => (
                <div key={i} className={cn(i > 0 && "mt-1 border-t border-slate-100 pt-1")}>
                  {group.map((q) => (
                    <Link key={q.href} href={q.href} className="block rounded-lg px-3 py-2 text-[13px] text-slate-700 transition hover:bg-slate-50 hover:text-slate-900">
                      {q.label}
                    </Link>
                  ))}
                </div>
              ))}
            </Dropdown>
          )}

          <Link
            href={notificationsHref}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white ring-2 ring-white">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>

          <Dropdown
            trigger={
              <button className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 transition hover:bg-slate-100" aria-label="Account menu">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">
                  {initials(userName)}
                </span>
                <ChevronDown size={14} className="text-slate-400" />
              </button>
            }
          >
            <div className="border-b border-slate-100 px-3 pb-2.5 pt-1.5">
              <p className="text-sm font-semibold text-slate-900">{userName}</p>
              <p className="truncate text-xs text-slate-500">{userEmail}</p>
              <p className="mt-1.5 inline-block rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">{roleLabel}</p>
            </div>
            <Link href={profileHref} className="mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50">
              <UserCircle size={16} className="text-slate-400" /> My profile
            </Link>
            <Link href="/change-password" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50">
              <KeyRound size={16} className="text-slate-400" /> Change password
            </Link>
            <form action={logoutAction} className="mt-1 border-t border-slate-100 pt-1">
              <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-red-600 hover:bg-red-50">
                <LogOut size={16} /> Sign out
              </button>
            </form>
          </Dropdown>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-7 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
