/** A segmented switch: By kind · By colour · By place. */
export function Seg<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value?: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg2" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
