import { useSyncExternalStore } from 'react';

interface T { id: number; label: string; undo?: () => void }
let toast: T | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let n = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Shows a short message above the tab bar, with Undo when given. */
export function showToast(label: string, undo?: () => void) {
  toast = { id: ++n, label, undo };
  clearTimeout(timer);
  timer = setTimeout(() => { toast = null; emit(); }, undo ? 6000 : 3500);
  emit();
}

export function ToastHost() {
  const t = useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => toast);
  if (!t) return <div className="toast-slot" role="status" aria-live="polite" />;
  return (
    <div className="toast-slot" role="status" aria-live="polite">
      <div className="toast" key={t.id}>
        <span>{t.label}</span>
        {t.undo && (
          <button type="button" className="toast-undo" onClick={() => { const u = t.undo!; toast = null; emit(); u(); }}>
            Undo
          </button>
        )}
      </div>
    </div>
  );
}
