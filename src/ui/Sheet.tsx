import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * A bottom sheet. While open it publishes its height as --sheet-h on the page,
 * so lists add that much room at the bottom and the sheet never covers the last row.
 * `modal` dims the page and closes on a tap outside; a non-modal sheet sits over the tab bar.
 */
export function Sheet({ open, onClose, children, label, modal = true }: { open: boolean; onClose: () => void; children: ReactNode; label: string; modal?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const el = ref.current;
    const set = () => document.documentElement.style.setProperty('--sheet-h', `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty('--sheet-h');
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <>
      {modal && <div className="sheet-back" onClick={onClose} aria-hidden="true" />}
      <div ref={ref} className={`sheet${modal ? ' modal' : ''}`} role="dialog" aria-modal={modal} aria-label={label}>
        {children}
      </div>
    </>,
    document.body,
  );
}
