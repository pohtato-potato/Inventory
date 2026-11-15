import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Sheet } from './Sheet';

interface Ask { kind: 'text' | 'confirm'; title: string; placeholder?: string; initial?: string; yes?: string; resolve: (v: string | null) => void }
let current: Ask | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Asks for a short name in a sheet. Resolves to the trimmed text, or null when cancelled. */
export function askText(title: string, placeholder = '', initial = ''): Promise<string | null> {
  return new Promise((resolve) => {
    current?.resolve(null);
    current = { kind: 'text', title, placeholder, initial, resolve };
    emit();
  });
}

/** Asks yes or no in a sheet. */
export function askConfirm(title: string, yes = 'Yes'): Promise<boolean> {
  return new Promise((resolve) => {
    current?.resolve(null);
    current = { kind: 'confirm', title, yes, resolve: (v) => resolve(v !== null) };
    emit();
  });
}

export function AskHost() {
  const a = useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => current);
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (a?.kind === 'text') {
      setText(a.initial ?? '');
      setTimeout(() => input.current?.focus(), 50);
    }
  }, [a]);
  const done = (v: string | null) => {
    const r = current?.resolve;
    current = null;
    emit();
    r?.(v);
  };
  return (
    <Sheet open={!!a} onClose={() => done(null)} label={a?.title ?? ''}>
      {a && (
        <form onSubmit={(e) => { e.preventDefault(); if (a.kind === 'confirm') done('yes'); else if (text.trim()) done(text.trim()); }} style={{ display: 'grid', gap: 14 }}>
          <p className="name" style={{ fontSize: 22 }}>{a.title}</p>
          {a.kind === 'text' && <input ref={input} className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder={a.placeholder} aria-label={a.title} enterKeyHint="done" />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="ghost" onClick={() => done(null)}>Cancel</button>
            <button type="submit" className="acc" style={{ flex: 1 }} disabled={a.kind === 'text' && !text.trim()}>{a.kind === 'confirm' ? a.yes : 'Save'}</button>
          </div>
        </form>
      )}
    </Sheet>
  );
}
