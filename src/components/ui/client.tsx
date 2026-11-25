"use client";

import { useFormStatus } from "react-dom";
import { useState, type ComponentProps } from "react";
import { buttonClass, cn } from "./index";

export function SubmitButton({
  children,
  pendingText = "Saving…",
  variant = "primary",
  size = "md",
  className,
  confirm,
  ...props
}: ComponentProps<"button"> & {
  pendingText?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success" | "warning";
  size?: "sm" | "md" | "lg";
  /** When set, the first click asks for confirmation inline before submitting. */
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  const [armed, setArmed] = useState(false);
  const cls = cn(buttonClass(variant, size), className);
  const spinner = <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />;

  if (!confirm) {
    return (
      <button type="submit" disabled={pending || props.disabled} className={cls} {...props}>
        {pending && spinner}
        {pending ? pendingText : children}
      </button>
    );
  }
  if (!armed) {
    return (
      <button type="button" className={cls} onClick={() => setArmed(true)}>
        {children}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      {!pending && <span className="text-xs text-slate-600">{confirm}</span>}
      <button type="submit" disabled={pending || props.disabled} className={cls} {...props}>
        {pending && spinner}
        {pending ? pendingText : "Confirm"}
      </button>
      {!pending && (
        <button type="button" className={buttonClass("ghost", size)} onClick={() => setArmed(false)}>
          Cancel
        </button>
      )}
    </span>
  );
}
