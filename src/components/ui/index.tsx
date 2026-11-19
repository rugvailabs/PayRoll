import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, Inbox } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

export { clsx as cn };

/* ---------------- Buttons ---------------- */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
const variantClass: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white shadow-[0_1px_2px_rgba(16,24,40,0.12),inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-brand-700 focus-visible:ring-brand-200",
  secondary:
    "bg-white text-slate-700 ring-1 ring-inset ring-slate-200 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-brand-200",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-brand-200",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-200",
  success: "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 focus-visible:ring-emerald-200",
};
const sizeClass = { sm: "h-8 px-3 text-xs", md: "h-9 px-3.5 text-sm", lg: "h-11 px-5 text-sm" };

export function buttonClass(variant: Variant = "primary", size: keyof typeof sizeClass = "md") {
  return clsx(
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition whitespace-nowrap cursor-pointer",
    "focus-visible:outline-none focus-visible:ring-4 disabled:opacity-60 disabled:pointer-events-none",
    variantClass[variant],
    sizeClass[size],
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: keyof typeof sizeClass }) {
  return <button className={clsx(buttonClass(variant, size), className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof sizeClass }) {
  return <Link className={clsx(buttonClass(variant, size), className)} {...props} />;
}

/* ---------------- Layout ---------------- */

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link
          href={back.href}
          className="mb-3 inline-flex items-center gap-1 rounded-md text-[13px] font-medium text-slate-500 transition hover:text-brand-600"
        >
          <ChevronLeft size={15} /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.01em] text-slate-900">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={clsx("rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("p-5", className)}>{children}</div>;
}

const toneIcon = {
  slate: "bg-slate-100 text-slate-600",
  blue: "bg-brand-50 text-brand-600",
  green: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
};

export function StatCard({
  label,
  value,
  hint,
  tone = "slate",
  href,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "slate" | "blue" | "green" | "amber" | "red";
  href?: string;
  icon?: ReactNode;
}) {
  const body = (
    <Card className={clsx("h-full p-5", href && "transition hover:border-slate-300 hover:shadow-md")}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-slate-500">{label}</p>
        {icon && <span className={clsx("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", toneIcon[tone])}>{icon}</span>}
      </div>
      <p
        className={clsx(
          "mt-1 text-[26px] font-semibold leading-tight tracking-tight tabular-nums",
          tone === "red" ? "text-red-600" : "text-slate-900",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1.5 truncate text-xs text-slate-500">{hint}</p>}
    </Card>
  );
  return href ? (
    <Link href={href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100">
      {body}
    </Link>
  ) : (
    body
  );
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400">
        {icon ?? <Inbox size={22} />}
      </div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------------- Badges ---------------- */

const tones = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/15 [--dot:#10b981]",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/15 [--dot:#3b82f6]",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/20 [--dot:#f59e0b]",
  slate: "bg-slate-100 text-slate-600 ring-slate-500/15 [--dot:#94a3b8]",
  red: "bg-red-50 text-red-700 ring-red-600/15 [--dot:#ef4444]",
  purple: "bg-violet-50 text-violet-700 ring-violet-600/15 [--dot:#8b5cf6]",
};
const badgeTone: Record<string, keyof typeof tones> = {
  ACTIVE: "green", APPROVED: "green", PAID: "green",
  SENT: "blue", SUBMITTED: "blue",
  PARTIAL: "amber",
  DRAFT: "slate", INACTIVE: "slate", ENDED: "slate", VOID: "slate",
  REJECTED: "red", OVERDUE: "red", TERMINATED: "red",
  ON_HOLD: "purple",
};

export function Badge({ status, children }: { status: string; children?: ReactNode }) {
  const label = children ?? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
  const tone = tones[badgeTone[status] ?? "slate"];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
        tone,
        status === "VOID" && "line-through",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--dot)]" aria-hidden />
      {label}
    </span>
  );
}

/* ---------------- Form fields ---------------- */

export function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

type FieldBase = { label: string; name: string; required?: boolean; error?: string; hint?: string; className?: string };

export function TextField({
  label,
  name,
  required,
  error,
  hint,
  className,
  ...props
}: FieldBase & Omit<ComponentProps<"input">, "name">) {
  return (
    <Field label={label} htmlFor={name} required={required} error={error} hint={hint} className={className}>
      <input id={name} name={name} required={required} aria-invalid={!!error} className="control" {...props} />
    </Field>
  );
}

export function SelectField({
  label,
  name,
  required,
  error,
  hint,
  className,
  options,
  placeholder = "Select…",
  ...props
}: FieldBase & Omit<ComponentProps<"select">, "name"> & {
  options: { value: string; label: string }[];
  placeholder?: string | false;
}) {
  return (
    <Field label={label} htmlFor={name} required={required} error={error} hint={hint} className={className}>
      <select id={name} name={name} required={required} aria-invalid={!!error} className="control" {...props}>
        {placeholder !== false && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function TextAreaField({
  label,
  name,
  required,
  error,
  hint,
  className,
  ...props
}: FieldBase & Omit<ComponentProps<"textarea">, "name">) {
  return (
    <Field label={label} htmlFor={name} required={required} error={error} hint={hint} className={className}>
      <textarea id={name} name={name} required={required} aria-invalid={!!error} className="control min-h-20" {...props} />
    </Field>
  );
}

export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="grid gap-6 border-b border-slate-100 px-6 py-7 last:border-b-0 lg:grid-cols-[minmax(0,15rem)_1fr] lg:gap-10">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{description}</p>}
      </div>
      <div className="grid content-start gap-x-4 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "error" | "success" | "warning"; children: ReactNode }) {
  const cls = {
    info: "bg-brand-50/70 text-brand-800 border-brand-100 [--bar:#4f62e8]",
    error: "bg-red-50 text-red-800 border-red-100 [--bar:#ef4444]",
    success: "bg-emerald-50 text-emerald-800 border-emerald-100 [--bar:#10b981]",
    warning: "bg-amber-50 text-amber-900 border-amber-100 [--bar:#f59e0b]",
  }[tone];
  return (
    <div className={clsx("relative overflow-hidden rounded-lg border py-3 pl-4 pr-4 text-sm", cls)}>
      <span className="absolute inset-y-0 left-0 w-1 bg-[var(--bar)]" aria-hidden />
      {children}
    </div>
  );
}

export function DescList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-xs font-medium text-slate-500">{i.label}</dt>
          <dd className="mt-1 text-sm font-medium text-slate-900 break-words">{i.value || <span className="font-normal text-slate-400">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  const palette = [
    "bg-indigo-100 text-indigo-700", "bg-sky-100 text-sky-700", "bg-emerald-100 text-emerald-700",
    "bg-amber-100 text-amber-800", "bg-rose-100 text-rose-700", "bg-violet-100 text-violet-700", "bg-teal-100 text-teal-700",
  ];
  const color = palette[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length];
  const sz = { sm: "h-7 w-7 text-[11px]", md: "h-9 w-9 text-xs", lg: "h-14 w-14 text-lg" }[size];
  return (
    <span className={clsx("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", color, sz)}>
      {initials || "?"}
    </span>
  );
}

export function Tabs({ tabs, active }: { tabs: { key: string; label: string; href: string; count?: number }[]; active: string }) {
  return (
    <div className="mb-5 flex gap-6 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            className={clsx(
              "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 pb-3 pt-1 text-sm font-medium transition",
              on ? "border-brand-600 text-slate-900" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800",
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={clsx(
                  "rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums",
                  on ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500",
                )}
              >
                {t.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

/** Toolbar row above a table (search/filters). */
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">{children}</div>;
}
