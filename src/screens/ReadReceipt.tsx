import { useEffect, useRef, useState } from 'react';
import { parseReceipt } from '../read/parse';
import { roughDateText } from '../domain/format';
import { parseRoughDate } from '../domain/estimate';

export interface ReceiptValues {
  shop?: string;
  when?: string;
  price?: string;
  name?: string;
  size?: string;
}

const LABELS: [keyof ReceiptValues, string][] = [['name', 'Name'], ['shop', 'Shop'], ['when', 'Bought'], ['price', 'Price'], ['size', 'Size']];

/** "Read a receipt or order screenshot": every value found is an editable guess; only ticked ones are used. */
export function ReadReceipt({ onUse, start }: { onUse: (r: ReceiptValues) => void; start?: File | null }) {
  const file = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<'idle' | 'reading' | 'none' | 'found' | 'failed'>('idle');
  const [progress, setProgress] = useState(0);
  const [vals, setVals] = useState<ReceiptValues>({});
  const [ticked, setTicked] = useState<Set<keyof ReceiptValues>>(new Set());

  const read = async (f: File) => {
    setState('reading');
    setProgress(0);
    try {
      const { readImage } = await import('../read/reader');
      const g = parseReceipt(await readImage(f, setProgress));
      const v: ReceiptValues = {
        ...(g.name ? { name: g.name } : {}),
        ...(g.shop ? { shop: g.shop } : {}),
        ...(g.date ? { when: roughDateText(parseRoughDate(g.date) ?? undefined) } : {}),
        ...(g.price ? { price: `₹${g.price.toLocaleString('en-IN')}` } : {}),
        ...(g.size ? { size: g.size } : {}),
      };
      setVals(v);
      setTicked(new Set(Object.keys(v) as (keyof ReceiptValues)[]));
      setState(Object.keys(v).length ? 'found' : 'none');
    } catch {
      setState('failed');
    }
  };

  // A receipt picked from the add sheet is read as soon as the form opens.
  useEffect(() => { if (start) void read(start); }, [start]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`receipt${state === 'reading' ? ' reading' : ''}`}>
      <button type="button" className="ghost" onClick={() => file.current?.click()} disabled={state === 'reading'}>
        {state === 'reading' ? `Reading… ${Math.round(progress * 100)}%` : 'Read a receipt or order screenshot'}
      </button>
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ''; }} />
      {state === 'none' && <p className="m" role="status">Couldn't read anything useful from that photo.</p>}
      {state === 'failed' && <p className="m" role="status">The reader could not start. It needs the internet the first time.</p>}
      {state === 'found' && (
        <div className="receipt-found" role="group" aria-label="Read from the photo">
          <p className="m sm">Read from the photo. Check each one; only ticked ones are used.</p>
          {LABELS.filter(([k]) => vals[k] !== undefined).map(([k, label]) => (
            <div key={k} className="receipt-row">
              <input type="checkbox" id={`rr-${k}`} checked={ticked.has(k)} onChange={() => setTicked((t) => { const n = new Set(t); if (n.has(k)) n.delete(k); else n.add(k); return n; })} />
              <label htmlFor={`rr-${k}`} className="sm" style={{ width: 64, flex: 'none' }}>{label}</label>
              <input className="field" value={vals[k]} aria-label={`${label}, read from the photo`} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="ghost" onClick={() => setState('idle')}>Ignore</button>
            <button type="button" className="acc" style={{ flex: 1 }} disabled={!ticked.size} onClick={() => { onUse(Object.fromEntries([...ticked].map((k) => [k, vals[k]])) as ReceiptValues); setState('idle'); }}>Use these</button>
          </div>
        </div>
      )}
    </div>
  );
}
