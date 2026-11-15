import { useCallback, useState } from 'react';
import type { Trees } from '../db/hooks';
import type { Id } from '../domain/types';

export interface SelectionState {
  ids: Set<Id>;
  toggle: (id: Id) => void;
  clear: () => void;
}

export function useSelection(): SelectionState {
  const [ids, setIds] = useState<Set<Id>>(new Set());
  const toggle = useCallback((id: Id) => setIds((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);
  const clear = useCallback(() => setIds(new Set()), []);
  return { ids, toggle, clear };
}

/** The top bar while selecting; Task 12 adds the move sheet. */
export function Selection({ sel }: { sel: SelectionState; trees: Trees }) {
  return (
    <div className="top">
      <h1 className="caps">{sel.ids.size} selected</h1>
      <button type="button" className="link" style={{ marginLeft: 'auto', color: 'var(--m)' }} onClick={sel.clear}>Cancel</button>
    </div>
  );
}
