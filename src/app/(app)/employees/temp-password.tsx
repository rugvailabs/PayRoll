"use client";

import { useState } from "react";

export function TempPasswordBox({ password }: { password: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-medium text-amber-900">Temporary password (shown only once)</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 rounded-md bg-white px-3 py-2 font-mono text-base tracking-wider text-slate-900 ring-1 ring-amber-200">
          {password}
        </code>
        <button
          type="button"
          className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(password);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {}
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-2 text-xs text-amber-800">
        The employee must change it at first sign-in. Share it through a secure channel.
      </p>
    </div>
  );
}
