"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bell,
  Briefcase,
  Building2,
  ChevronDown,
  Clock,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Plus,
  Receipt,
  Settings,
  UserCircle,
  Users,
  Wallet,
  X,
  KeyRound,
  Hourglass,
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

function Dropdown({ trigger, children, align = "right" }: { trigger: ReactNode; children: ReactNode; align?: "left" | "right" }) {
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
            "absolute z-40 mt-2 min-w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
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
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => setMobileOpen(false), [pathname]);

  // Highlight the most specific nav item that matches the current path.
  const activeHref = nav
    .flatMap((g) => g.items.map((i) => i.href))
    .filter((h) => pathname === h || pathname.startsWith(h + "/"))
    .sort((a, b) => b.length - a.length)[0];

  const sidebar = (
    <nav className="flex h-full flex-col bg-ink-900 text-slate-300">
      <div className="flex h-16 items-center gap-2.5 px-5 text-white">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 font-semibold">P</span>
        <span className="text-base font-semibold">{APP_NAME}</span>
      </div>
      <div className="mx-3 mb-3 rounded-lg bg-white/5 px-3 py-2">
        <p className="text-[11px] uppercase tracking-wide text-slate-500">{portalLabel ?? "Organization"}</p>
        <p className="truncate text-sm font-medium text-white">{orgName}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-6">
        {nav.map((g, gi) => (
          <div key={gi} className="mt-4 first:mt-1">
            {g.title && <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{g.title}</p>}
            {g.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = item.href === activeHref;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                    active ? "bg-brand-600 text-white" : "hover:bg-white/5 hover:text-white",
                  )}
                >
                  <Icon size={17} className={active ? "text-white" : "text-slate-400 group-hover:text-white"} />
                  <span className="flex-1">{item.label}</span>
                  {!!item.badge && (
                    <span className={cn("rounded-full px-1.5 text-[11px] font-semibold", active ? "bg-white/20" : "bg-red-500 text-white")}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64">{sidebar}</aside>
          <button className="absolute left-66 top-4 rounded-md bg-white p-1.5" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div className="flex-1" />

          {quickLinks.length > 0 && (
            <Dropdown
              trigger={
                <button className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white shadow-sm hover:bg-brand-700">
                  <Plus size={16} /> <span className="hidden sm:inline">Quick add</span>
                </button>
              }
            >
              {quickLinks.map((group, i) => (
                <div key={i} className={cn(i > 0 && "mt-1 border-t border-slate-100 pt-1")}>
                  {group.map((q) => (
                    <Link key={q.href} href={q.href} className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      {q.label}
                    </Link>
                  ))}
                </div>
              ))}
            </Dropdown>
          )}

          <Link href={notificationsHref} className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label="Notifications">
            <Bell size={20} />
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>

          <Dropdown
            trigger={
              <button className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-slate-100">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                  {userName.charAt(0).toUpperCase()}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block text-sm font-medium leading-tight text-slate-800">{userName}</span>
                  <span className="block text-xs leading-tight text-slate-500">{roleLabel}</span>
                </span>
                <ChevronDown size={14} className="text-slate-400" />
              </button>
            }
          >
            <div className="border-b border-slate-100 px-3 py-2">
              <p className="text-sm font-medium text-slate-800">{userName}</p>
              <p className="text-xs text-slate-500">{userEmail}</p>
            </div>
            <Link href={profileHref} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <UserCircle size={16} /> My profile
            </Link>
            <Link href="/change-password" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <KeyRound size={16} /> Change password
            </Link>
            <form action={logoutAction}>
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                <LogOut size={16} /> Sign out
              </button>
            </form>
          </Dropdown>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
