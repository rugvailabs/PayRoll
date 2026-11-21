"use client";

/** Header checkbox that toggles every `name` checkbox inside the same form. */
export function SelectAll({ name = "ids", label = "Select all" }: { name?: string; label?: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      className="h-4 w-4"
      onChange={(e) => {
        const form = e.currentTarget.form;
        form?.querySelectorAll<HTMLInputElement>(`input[type=checkbox][name="${name}"]:not(:disabled)`).forEach((c) => {
          c.checked = e.currentTarget.checked;
        });
      }}
    />
  );
}

/** Opens `href?ids=...` for the checked `name` checkboxes in the same form (e.g. ZIP download). */
export function DownloadSelected({ href, name = "ids", children, className }: { href: string; name?: string; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={(e) => {
        const form = e.currentTarget.closest("form");
        const ids = [...(form?.querySelectorAll<HTMLInputElement>(`input[type=checkbox][name="${name}"]:checked`) ?? [])].map((c) => c.value);
        if (!ids.length) {
          alertBox(e.currentTarget, "Select at least one row first.");
          return;
        }
        const p = new URLSearchParams();
        ids.forEach((id) => p.append("ids", id));
        window.location.href = `${href}?${p}`;
      }}
    >
      {children}
    </button>
  );
}

function alertBox(el: HTMLElement, msg: string) {
  const prev = el.getAttribute("data-label") ?? el.innerHTML;
  el.setAttribute("data-label", prev);
  el.textContent = msg;
  setTimeout(() => { el.innerHTML = prev; }, 1800);
}
