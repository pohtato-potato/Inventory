import { useEffect, useRef, useState } from 'react';

/** A number that rolls one step when it changes: the old value slides up and out, the new one in. */
export function Tick({ value, className = '' }: { value: number; className?: string }) {
  const prev = useRef(value);
  const [shift, setShift] = useState<{ from: number; n: number } | null>(null);
  useEffect(() => {
    if (prev.current !== value) setShift((s) => ({ from: prev.current, n: (s?.n ?? 0) + 1 }));
    prev.current = value;
  }, [value]);
  return (
    <span className={`tick-n ${className}`} aria-label={String(value)}>
      {shift && <span key={`o${shift.n}`} className="tick-out" aria-hidden="true">{shift.from}</span>}
      <span key={`i${shift?.n ?? 0}`} className={shift ? 'tick-in' : undefined} aria-hidden="true">{value}</span>
    </span>
  );
}
