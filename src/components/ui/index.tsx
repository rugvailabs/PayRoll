import Link from "next/link";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

export { clsx as cn };

/* ---------------- Buttons ---------------- */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
const variantClass: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
  secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-xs",
  ghost: "text-slate-600 hover:bg-slate-100",
  danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
};
const sizeClass = { sm: "h-8 px-3 text-xs", md: "h-9 px-4 text-sm", lg: "h-11 px-5 text-sm" };

export function buttonClass(variant: Variant = "primary", size: keyof typeof sizeClass = "md") {
  return clsx(
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition whitespace-nowrap disabled:opacity-60 disabled:pointer-events-none cursor-pointer",
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
        <Link href={back.href} className="mb-2 inline-flex items-center text-sm text-slate-500 hover:text-brand-600">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("rounded-xl border border-slate-200 bg-white shadow-xs", className)}>{children}</div>;
}

export function CardHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("p-5", className)}>{children}</div>;
}

export function StatCard({
  label,
  value,
  hint,
  tone = "slate",
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "slate" | "blue" | "green" | "amber" | "red";
  href?: string;
}) {
  const accent = {
    slate: "bg-slate-400",
    blue: "bg-brand-500",
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
  }[tone];
  const body = (
    <Card className={clsx("relative overflow-hidden p-5", href && "transition hover:border-brand-200 hover:shadow-sm")}>
      <span className={clsx("absolute inset-y-0 left-0 w-1", accent)} />
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 text-xl">∅</div>
      <p className="font-medium text-slate-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------------- Badges ---------------- */

const badgeTone: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  PAID: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  SENT: "bg-blue-50 text-blue-700 ring-blue-600/20",
  SUBMITTED: "bg-blue-50 text-blue-700 ring-blue-600/20",
  PARTIAL: "bg-amber-50 text-amber-700 ring-amber-600/20",
  DRAFT: "bg-slate-100 text-slate-600 ring-slate-500/20",
  INACTIVE: "bg-slate-100 text-slate-600 ring-slate-500/20",
  ENDED: "bg-slate-100 text-slate-600 ring-slate-500/20",
  REJECTED: "bg-red-50 text-red-700 ring-red-600/20",
  OVERDUE: "bg-red-50 text-red-700 ring-red-600/20",
  TERMINATED: "bg-red-50 text-red-700 ring-red-600/20",
  VOID: "bg-slate-100 text-slate-500 ring-slate-500/20 line-through",
  ON_HOLD: "bg-purple-50 text-purple-700 ring-purple-600/20",
};

export function Badge({ status, children }: { status: string; children?: ReactNode }) {
  const label = children ?? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        badgeTone[status] ?? "bg-slate-100 text-slate-600 ring-slate-500/20",
      )}
    >
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
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
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
    <section className="grid gap-6 border-b border-slate-100 px-5 py-6 last:border-b-0 lg:grid-cols-4">
      <div className="lg:col-span-1">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-3 xl:grid-cols-3">{children}</div>
    </section>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "error" | "success" | "warning"; children: ReactNode }) {
  const cls = {
    info: "bg-blue-50 text-blue-800 border-blue-200",
    error: "bg-red-50 text-red-800 border-red-200",
    success: "bg-emerald-50 text-emerald-800 border-emerald-200",
    warning: "bg-amber-50 text-amber-800 border-amber-200",
  }[tone];
  return <div className={clsx("rounded-lg border px-4 py-3 text-sm", cls)}>{children}</div>;
}

export function DescList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((i) => (
        <div key={i.label}>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{i.label}</dt>
          <dd className="mt-1 text-sm text-slate-900 break-words">{i.value || "—"}</dd>
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
  const palette = ["bg-indigo-500", "bg-sky-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-violet-500", "bg-teal-500"];
  const color = palette[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length];
  const sz = { sm: "h-7 w-7 text-xs", md: "h-9 w-9 text-sm", lg: "h-14 w-14 text-lg" }[size];
  return (
    <span className={clsx("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", color, sz)}>
      {initials || "?"}
    </span>
  );
}

export function Tabs({ tabs, active }: { tabs: { key: string; label: string; href: string; count?: number }[]; active: string }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={clsx(
            "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition",
            t.key === active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800",
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{t.count}</span>
          )}
        </Link>
      ))}
    </div>
  );
}
