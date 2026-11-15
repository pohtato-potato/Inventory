import type { ReactNode } from 'react';

export interface ChipOption<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
  dot?: string;
  tone?: 'ok' | 'warn' | 'lo';
}

/** A row of choice chips. `scroll` keeps them on one line that scrolls sideways. */
export function Chips<T extends string>({
  options, value, onChange, label, scroll = false,
}: {
  options: ChipOption<T>[];
  value: T | T[] | undefined;
  onChange: (v: T) => void;
  label: string;
  scroll?: boolean;
}) {
  const on = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <div className={`chips${scroll ? ' scroll' : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`chip${on(o.value) ? ' on' : ''}${o.tone ? ` tone-${o.tone}` : ''}`}
          aria-pressed={on(o.value)}
          onClick={() => onChange(o.value)}
        >
          {o.dot && <span className="dot" style={{ background: o.dot }} />}
          {o.label}
          {o.count !== undefined && <span className="chip-n">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** A single chip that acts as a button. */
export function Chip({ children, on = false, onClick, dot, className = '' }: { children: ReactNode; on?: boolean; onClick?: () => void; dot?: string; className?: string }) {
  return (
    <button type="button" className={`chip${on ? ' on' : ''} ${className}`} onClick={onClick} aria-pressed={on}>
      {dot && <span className="dot" style={{ background: dot }} />}
      {children}
    </button>
  );
}
