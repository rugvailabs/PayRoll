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
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  const [armed, setArmed] = useState(false);
  if (confirm && !armed) {
    return (
      <button
        type="button"
        className={cn(buttonClass(variant, size), className)}
        onClick={() => setArmed(true)}
      >
        {children}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      {confirm && armed && !pending && <span className="text-xs text-slate-600">{confirm}</span>}
      <button
        type="submit"
        disabled={pending || props.disabled}
        className={cn(buttonClass(variant, size), className)}
        {...props}
      >
        {pending && (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {pending ? pendingText : confirm && armed ? "Confirm" : children}
      </button>
      {confirm && armed && !pending && (
        <button type="button" className={buttonClass("ghost", size)} onClick={() => setArmed(false)}>
          Cancel
        </button>
      )}
    </span>
  );
}
